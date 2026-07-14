"use client";

import dynamic from "next/dynamic";
import { openApiSpec } from "@/lib/swagger";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="swagger-dark">
      <style jsx global>{`
        .swagger-dark {
          background: #000;
          min-height: 100vh;
        }
        .swagger-ui {
          background: #000;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 20px 0;
        }
        .swagger-ui .info .title,
        .swagger-ui .info .description,
        .swagger-ui .info p,
        .swagger-ui .info li,
        .swagger-ui .opblock-tag,
        .swagger-ui .opblock .opblock-summary-description,
        .swagger-ui table thead tr th,
        .swagger-ui table tbody tr td,
        .swagger-ui .parameter__name,
        .swagger-ui .parameter__type,
        .swagger-ui .parameter__in,
        .swagger-ui .response-col_status,
        .swagger-ui .response-col_description,
        .swagger-ui label,
        .swagger-ui .btn,
        .swagger-ui select,
        .swagger-ui .model-title,
        .swagger-ui .model,
        .swagger-ui .model-box,
        .swagger-ui section.models h4,
        .swagger-ui .opblock-description-wrapper p,
        .swagger-ui .opblock-external-docs-wrapper p,
        .swagger-ui .opblock-title_normal p {
          color: #fff !important;
        }
        .swagger-ui .opblock.opblock-get {
          background: rgba(97, 175, 254, 0.1);
          border-color: #61affe;
        }
        .swagger-ui .opblock.opblock-post {
          background: rgba(73, 204, 144, 0.1);
          border-color: #49cc90;
        }
        .swagger-ui .opblock.opblock-put {
          background: rgba(252, 161, 48, 0.1);
          border-color: #fca130;
        }
        .swagger-ui .opblock.opblock-patch {
          background: rgba(80, 227, 194, 0.1);
          border-color: #50e3c2;
        }
        .swagger-ui .opblock.opblock-delete {
          background: rgba(249, 62, 62, 0.1);
          border-color: #f93e3e;
        }
        .swagger-ui .opblock .opblock-section-header {
          background: rgba(255, 255, 255, 0.05);
        }
        .swagger-ui .opblock .opblock-section-header h4 {
          color: #fff !important;
        }
        .swagger-ui section.models {
          background: #000;
          border-color: #333;
        }
        .swagger-ui section.models.is-open h4 {
          border-color: #333;
        }
        .swagger-ui .model-container {
          background: rgba(255, 255, 255, 0.05);
        }
        .swagger-ui .prop-type {
          color: #86b300 !important;
        }
        .swagger-ui .prop-format {
          color: #999 !important;
        }
        .swagger-ui input[type="text"],
        .swagger-ui textarea {
          background: #1a1a1a;
          border-color: #333;
          color: #fff;
        }
        .swagger-ui select {
          background: #1a1a1a;
          border-color: #333;
        }
        .swagger-ui .responses-inner {
          background: transparent;
        }
        .swagger-ui .response {
          background: transparent;
        }
        .swagger-ui .highlight-code {
          background: #1a1a1a !important;
        }
        .swagger-ui .highlight-code > pre {
          background: #1a1a1a !important;
        }
        .swagger-ui pre {
          background: #1a1a1a !important;
          color: #fff !important;
        }
        .swagger-ui .microlight {
          background: #1a1a1a !important;
          color: #fff !important;
        }
      `}</style>
      <SwaggerUI spec={openApiSpec} />
    </div>
  );
}
