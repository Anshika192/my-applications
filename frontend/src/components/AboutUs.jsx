import InfoLayout from "./InfoLayout";

export default function About({ setActiveTab }) {
  return (
    <InfoLayout
      title="About This Project"
      subtitle="Overview of the application"
      onBack={() => setActiveTab("dashboard")}
    >
      <p>
        This application is a unified productivity platform designed to provide
        multiple PDF, Image, and Document utilities in a single, easy‑to‑use
        web interface.
      </p>

      <p style={{ marginTop: 12 }}>
        The project focuses on building an integrated system where commonly used
        file‑processing tools are organized, accessible, and easy to use from
        one dashboard.
      </p>

      <div
        style={{
          marginTop: 24,
          paddingTop: 12,
          borderTop: "1px solid #e5e7eb",
          fontSize: 14
        }}
      >
        <strong>Company:</strong> TTL  
        <br />
        <span style={{ color: "#6b7280" }}>
          TTL is a technology‑focused organization working on digital solutions
          and software platforms.
        </span>
        <br /><br />
        <strong>Developed By:</strong> Anshika Pandey
      </div>
    </InfoLayout>
  );
}