import React from "react";

export default function JsonBlock({ value }: { value: any }) {
  return (
    <pre style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
