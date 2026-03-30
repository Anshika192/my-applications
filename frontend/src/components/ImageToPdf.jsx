import React, { useRef, useState } from "react";
import { jsPDF } from "jspdf";
import ToolLayout from "../components/ToolLayout";

const ImageToPdf = ({ setActiveTab, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // ✅ avoid multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setStatusMessage("");
    }
  };

  const convertToPdf = async () => {
    if (!selectedFile) return;

    setIsConverting(true);
    setStatusMessage("Converting image to PDF...");

    try {
      const reader = new FileReader();

      reader.onload = (e) => {
        const imgData = e.target.result;
        const img = new Image();
        img.src = imgData;

        img.onload = () => {
          const pdf = new jsPDF();
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();

          const imgRatio = img.width / img.height;
          const pdfRatio = pdfWidth / pdfHeight;

          let width, height;
          if (imgRatio > pdfRatio) {
            width = pdfWidth;
            height = pdfWidth / imgRatio;
          } else {
            height = pdfHeight;
            width = pdfHeight * imgRatio;
          }

          pdf.addImage(
            imgData,
            selectedFile.type === "image/png" ? "PNG" : "JPEG",
            (pdfWidth - width) / 2,
            (pdfHeight - height) / 2,
            width,
            height
          );

          pdf.save(selectedFile.name.replace(/\.(jpg|jpeg|png)$/i, ".pdf"));

          setStatusMessage(`Converted ${selectedFile.name} successfully!`);
          setIsConverting(false);

          // ✅ RECENT ACTIVITY: only after successful PDF save
          const now = Date.now();
          if (now - lastSuccessRef.current > 800) {
            onSuccess?.("image-to-pdf", "Image to PDF");
            lastSuccessRef.current = now;
          }
        };

        img.onerror = () => {
          setStatusMessage("Error converting image to PDF");
          setIsConverting(false);
        };
      };

      reader.onerror = () => {
        setStatusMessage("Error reading the image file");
        setIsConverting(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error(error);
      setStatusMessage("Error converting image to PDF");
      setIsConverting(false);
    }
  };

  return (
    <ToolLayout
      title="Image To PDF"
      description="Convert an image (JPG/PNG) into a PDF."
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ marginBottom: "20px", width: "100%" }}
      />

      <button
        onClick={convertToPdf}
        disabled={!selectedFile || isConverting}
        style={{
          padding: "10px 20px",
          backgroundColor: selectedFile ? "#4a90e2" : "#9bbce0",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: selectedFile ? "pointer" : "not-allowed",
          fontSize: "15px",
          width: "100%"
        }}
      >
        {isConverting ? "Converting..." : "Convert to PDF"}
      </button>

      {statusMessage && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: statusMessage.startsWith("Error") ? "#fee2e2" : "#dcfce7",
            color: statusMessage.startsWith("Error") ? "#991b1b" : "#166534",
            borderRadius: "8px",
            fontSize: "14px"
          }}
        >
          {statusMessage}
        </div>
      )}
    </ToolLayout>
  );
};

export default ImageToPdf;