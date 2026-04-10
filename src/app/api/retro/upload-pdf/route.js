import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const BUCKET = "retro-pdfs";

async function getUser(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) {
    await supabaseAdmin.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: 52428800,
    });
    return;
  }
  await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 52428800,
  });
}

export async function POST(req) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const sessionId = formData.get("session_id");

    if (!file || !sessionId) {
      return NextResponse.json({ error: "file and session_id are required" }, { status: 400 });
    }

    await ensureBucket();

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `retro-${sessionId}-${Date.now()}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("PDF upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(filename);

    const { error: updateError } = await supabaseAdmin
      .from("retro_sessions")
      .update({ pdf_url: urlData.publicUrl })
      .eq("id", sessionId);

    if (updateError) {
      console.error("Failed to save pdf_url:", updateError);
    }

    return NextResponse.json({ success: true, pdf_url: urlData.publicUrl });
  } catch (err) {
    console.error("Upload PDF error:", err);
    return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
  }
}
