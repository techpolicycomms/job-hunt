// GET /api/documents/[id]?type=cv|cover_letter — Download PDF
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderCVtoPDF, renderCoverLetterToPDF } from "@/lib/pdf";
import type { CVContent, CoverLetterContent } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in first" }, { status: 401 });
    }

    const docType = request.nextUrl.searchParams.get("type") ?? "cv";

    // Load materials
    const { data: materials, error } = await supabase
      .from("generated_materials")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !materials) {
      return NextResponse.json({ success: false, error: "Materials not found" }, { status: 404 });
    }

    const filePrefix = materials.file_prefix ?? "Document";

    if (docType === "cv") {
      if (!materials.cv_content) {
        return NextResponse.json({ success: false, error: "No CV content" }, { status: 404 });
      }
      const pdfBuffer = await renderCVtoPDF(materials.cv_content as CVContent);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filePrefix}_CV.pdf"`,
        },
      });
    } else if (docType === "cover_letter") {
      if (!materials.cover_letter_content) {
        return NextResponse.json({ success: false, error: "No cover letter content" }, { status: 404 });
      }
      const candidateName = (materials.cv_content as CVContent)?.name ?? "Candidate";
      const pdfBuffer = await renderCoverLetterToPDF(
        materials.cover_letter_content as CoverLetterContent,
        candidateName
      );
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filePrefix}_CoverLetter.pdf"`,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid type. Use cv or cover_letter" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
