import InfoLayout from "./InfoLayout";
import { CATEGORIES } from "./DashboardFolders";

const TOOL_DESC = {
  "pdf-to-text": "Extract editable text from PDF files.",
  "pdf-merge": "Merge multiple PDFs into one document.",
  "pdf-to-word": "Convert PDF documents into Word files.",
  "pdf-split": "Split PDF into selected or individual pages.",
  "pdf-watermark": "Add watermark text to PDF files.",
  "pdf-page-number": "Insert page numbers in PDFs.",
  "pdf-toolkit": "All‑in‑one PDF operations suite.",

  "image-to-pdf": "Create PDFs from images.",
  "image-compressor": "Reduce image file size efficiently.",
  "image-format-converter": "Convert images between formats.",
  "image-to-text": "Extract text from images.",
  "pdf-to-image": "Convert PDF pages into images.",
  "image-toolkit": "Resize, crop and view image metadata.",
  "bg-remover": "Remove background and generate transparent PNG.",

  "word-to-pdf": "Convert Word documents to PDF format.",
  "qr-generator": "Generate QR codes from text or URLs.",
  "ppt-to-excel": "Extract tables from PPT into Excel sheets.",

  "meeting-mom": "Generate structured meeting minutes."
};

export default function ToolsHelp({ setActiveTab }) {
  const isDark = document.body.classList.contains("dark-theme");

  return (
    <InfoLayout
      title="Tools Overview"
      subtitle="All available tools in this platform"
      onBack={() => setActiveTab("dashboard")}
    >
      {CATEGORIES.map((cat) => (
        <div key={cat.title} style={{ marginBottom: 30 }}>
          <h3 style={{ marginBottom: 12 }}>{cat.title}</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16
            }}
          >
            {cat.apps.map((tool) => (
              <div
                key={tool.tab}
                style={{
                  background: isDark ? "#1f2937" : "#f9fafb",
                  border: isDark ? "1px solid #374151" : "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 16,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start"
                }}
              >
                <img
                  src={tool.icon}
                  alt={tool.name}
                  style={{ width: 36, height: 36 }}
                />

                <div>
                  <div style={{ fontWeight: 600 }}>
                    {tool.name}
                  </div>
                  <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
                    {TOOL_DESC[tool.tab] || "Utility tool"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </InfoLayout>
  );
}