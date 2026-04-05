// ============================================================
// src/lib/pdf.ts
// PDF generation for ATS-friendly CVs and cover letters.
// Uses @react-pdf/renderer for server-side PDF creation.
// SERVER-SIDE ONLY.
// ============================================================

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CVContent, CoverLetterContent } from "@/lib/types";

// ============================================================
// STYLES — Clean, ATS-friendly single-column layout
// ============================================================

const cvStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  name: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    textAlign: "center",
  },
  contactLine: {
    fontSize: 9,
    textAlign: "center",
    color: "#444",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 2,
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  summary: {
    marginBottom: 4,
  },
  roleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 2,
  },
  roleTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  rolePeriod: {
    fontSize: 9,
    color: "#555",
  },
  roleOrg: {
    fontSize: 9,
    color: "#555",
    marginBottom: 3,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 8,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
  },
  educationItem: {
    marginBottom: 3,
  },
  educationDegree: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  educationInstitution: {
    fontSize: 9,
    color: "#555",
  },
  skillsText: {
    fontSize: 9.5,
  },
  certItem: {
    fontSize: 9.5,
    marginBottom: 1,
  },
});

const clStyles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    lineHeight: 1.6,
  },
  date: {
    marginBottom: 20,
    fontSize: 10,
    color: "#555",
  },
  salutation: {
    marginBottom: 12,
    fontFamily: "Helvetica-Bold",
  },
  paragraph: {
    marginBottom: 10,
  },
  closing: {
    marginTop: 16,
    marginBottom: 4,
  },
  name: {
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
  },
});

// ============================================================
// CV PDF DOCUMENT
// ============================================================

function CVDocument({ cv }: { cv: CVContent }) {
  const contactParts = [
    cv.contact.email,
    cv.contact.phone,
    cv.contact.linkedin,
    cv.contact.location,
  ].filter(Boolean);

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: cvStyles.page },
      // Name
      React.createElement(Text, { style: cvStyles.name }, cv.name),
      // Contact line
      React.createElement(
        Text,
        { style: cvStyles.contactLine },
        contactParts.join("  |  ")
      ),
      // Professional Summary
      React.createElement(
        Text,
        { style: cvStyles.sectionTitle },
        "PROFESSIONAL SUMMARY"
      ),
      React.createElement(Text, { style: cvStyles.summary }, cv.summary),
      // Experience
      React.createElement(Text, { style: cvStyles.sectionTitle }, "EXPERIENCE"),
      ...cv.experience.map((role, i) =>
        React.createElement(
          View,
          { key: `role-${i}` },
          React.createElement(
            View,
            { style: cvStyles.roleHeader },
            React.createElement(
              Text,
              { style: cvStyles.roleTitle },
              role.title
            ),
            React.createElement(
              Text,
              { style: cvStyles.rolePeriod },
              role.period
            )
          ),
          React.createElement(
            Text,
            { style: cvStyles.roleOrg },
            role.organization
          ),
          ...role.bullets.map((bullet, j) =>
            React.createElement(
              View,
              { style: cvStyles.bullet, key: `bullet-${i}-${j}` },
              React.createElement(Text, { style: cvStyles.bulletDot }, "\u2022"),
              React.createElement(Text, { style: cvStyles.bulletText }, bullet)
            )
          )
        )
      ),
      // Education
      React.createElement(Text, { style: cvStyles.sectionTitle }, "EDUCATION"),
      ...cv.education.map((edu, i) =>
        React.createElement(
          View,
          { style: cvStyles.educationItem, key: `edu-${i}` },
          React.createElement(
            Text,
            { style: cvStyles.educationDegree },
            edu.degree
          ),
          React.createElement(
            Text,
            { style: cvStyles.educationInstitution },
            `${edu.institution} (${edu.period})`
          )
        )
      ),
      // Skills
      React.createElement(Text, { style: cvStyles.sectionTitle }, "SKILLS"),
      React.createElement(
        Text,
        { style: cvStyles.skillsText },
        cv.skills.join("  \u2022  ")
      ),
      // Certifications
      cv.certifications.length > 0
        ? React.createElement(
            View,
            null,
            React.createElement(
              Text,
              { style: cvStyles.sectionTitle },
              "CERTIFICATIONS"
            ),
            ...cv.certifications.map((cert, i) =>
              React.createElement(
                Text,
                { style: cvStyles.certItem, key: `cert-${i}` },
                cert
              )
            )
          )
        : null,
      // Publications
      cv.publications.length > 0
        ? React.createElement(
            View,
            null,
            React.createElement(
              Text,
              { style: cvStyles.sectionTitle },
              "PUBLICATIONS"
            ),
            ...cv.publications.map((pub, i) =>
              React.createElement(
                Text,
                { style: cvStyles.certItem, key: `pub-${i}` },
                pub
              )
            )
          )
        : null
    )
  );
}

// ============================================================
// COVER LETTER PDF DOCUMENT
// ============================================================

function CoverLetterDocument({
  cl,
  candidateName,
}: {
  cl: CoverLetterContent;
  candidateName: string;
}) {
  const today = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: clStyles.page },
      React.createElement(Text, { style: clStyles.date }, today),
      React.createElement(Text, { style: clStyles.salutation }, cl.salutation),
      ...cl.paragraphs.map((para, i) =>
        React.createElement(
          Text,
          { style: clStyles.paragraph, key: `para-${i}` },
          para
        )
      ),
      React.createElement(Text, { style: clStyles.closing }, cl.closing),
      React.createElement(Text, { style: clStyles.name }, candidateName)
    )
  );
}

// ============================================================
// PDF RENDERING
// ============================================================

export async function renderCVtoPDF(cv: CVContent): Promise<Buffer> {
  const doc = React.createElement(CVDocument, { cv });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await renderToBuffer(doc as any);
}

export async function renderCoverLetterToPDF(
  cl: CoverLetterContent,
  candidateName: string
): Promise<Buffer> {
  const doc = React.createElement(CoverLetterDocument, {
    cl,
    candidateName,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await renderToBuffer(doc as any);
}

// ============================================================
// FILE NAMING
// ============================================================

/**
 * Generate a standardized file prefix for documents.
 * Format: Jha_Rahul_Google_ProgrammeManager_20260404
 */
export function generateFilePrefix(
  candidateName: string,
  company: string,
  jobTitle: string
): string {
  const nameParts = candidateName.trim().split(/\s+/);
  const lastName = nameParts[nameParts.length - 1] ?? "Unknown";
  const firstName = nameParts[0] ?? "Unknown";

  const cleanCompany = company
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("");

  const cleanTitle = jobTitle
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return `${lastName}_${firstName}_${cleanCompany}_${cleanTitle}_${date}`;
}
