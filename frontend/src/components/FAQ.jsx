import { useState } from "react";
import InfoLayout from "./InfoLayout";

const FAQS = [
  {
    q: "Is this project industry based?",
    a: "Yes, it was developed during an industry internship."
  },
  {
    q: "Are these tools already available online?",
    a: "Yes, but this project focuses on system integration and implementation."
  },
  {
    q: "Is AI used in every tool?",
    a: "No, most tools are non‑AI utilities for stability and clarity."
  }
];

export default function FAQ({ setActiveTab }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <InfoLayout
      title="FAQ"
      subtitle="Frequently asked questions"
      onBack={() => setActiveTab("dashboard")}
    >
      {FAQS.map((item, i) => (
        <div
          key={i}
          style={{
            borderBottom: "1px solid #374151",
            paddingBottom: 12,
            marginBottom: 12,
            cursor: "pointer"
          }}
          onClick={() => setOpenIndex(openIndex === i ? null : i)}
        >
          <div style={{ fontWeight: 600 }}>
            {item.q}
          </div>

          {openIndex === i && (
            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                color: "#9ca3af",
                transition: "all 0.3s"
              }}
            >
              {item.a}
            </div>
          )}
        </div>
      ))}
    </InfoLayout>
  );
}
