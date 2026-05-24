import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Row,
  Column,
  Preview,
} from "@react-email/components";

export interface DigestEmailTemplateProps {
  date: string;
  sessions: number;
  totalCostUsd: number;
  anomalyCount: number;
  activeAlerts: Array<{ severity: string; message: string; source: string }>;
  briefingNarrative: string;
  findingsCount: number;
}

export function DigestEmailTemplate({
  date,
  sessions,
  totalCostUsd,
  anomalyCount,
  activeAlerts,
  briefingNarrative,
  findingsCount,
}: DigestEmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>CodePulse Daily Digest — {date}</Preview>
      <Body
        style={{
          backgroundColor: "#111827",
          fontFamily: "'Geist', 'Segoe UI', sans-serif",
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}
        >
          <Heading
            style={{
              color: "#e5e7eb",
              fontFamily: "'Cinzel', serif",
              fontSize: "20px",
              marginBottom: "4px",
            }}
          >
            CodePulse Daily Digest
          </Heading>
          <Text style={{ color: "#9ca3af", fontSize: "12px", marginTop: "0" }}>
            {date}
          </Text>
          <Hr style={{ borderColor: "#374151", margin: "16px 0" }} />

          {/* Metrics row */}
          <Section>
            <Row>
              <Column style={{ width: "33%", textAlign: "center" }}>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: "10px",
                    margin: "0",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Sessions
                </Text>
                <Text
                  style={{
                    color: "#f9fafb",
                    fontSize: "24px",
                    fontWeight: "600",
                    margin: "4px 0 0",
                  }}
                >
                  {sessions}
                </Text>
              </Column>
              <Column style={{ width: "33%", textAlign: "center" }}>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: "10px",
                    margin: "0",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Cost
                </Text>
                <Text
                  style={{
                    color: "#f9fafb",
                    fontSize: "24px",
                    fontWeight: "600",
                    margin: "4px 0 0",
                  }}
                >
                  ${totalCostUsd.toFixed(4)}
                </Text>
              </Column>
              <Column style={{ width: "33%", textAlign: "center" }}>
                <Text
                  style={{
                    color: "#9ca3af",
                    fontSize: "10px",
                    margin: "0",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Anomalies
                </Text>
                <Text
                  style={{
                    color: anomalyCount > 0 ? "#f87171" : "#f9fafb",
                    fontSize: "24px",
                    fontWeight: "600",
                    margin: "4px 0 0",
                  }}
                >
                  {anomalyCount}
                </Text>
              </Column>
            </Row>
          </Section>

          {findingsCount > 0 && (
            <Section style={{ marginTop: "16px" }}>
              <Text
                style={{
                  color: "#9ca3af",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "0 0 4px",
                }}
              >
                Ideation Findings
              </Text>
              <Text style={{ color: "#e5e7eb", fontSize: "14px", margin: "0" }}>
                {findingsCount} undismissed finding
                {findingsCount !== 1 ? "s" : ""}
              </Text>
            </Section>
          )}

          <Hr style={{ borderColor: "#374151", margin: "16px 0" }} />

          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <Section>
              <Text
                style={{
                  color: "#9ca3af",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  margin: "0 0 8px",
                }}
              >
                Active Alerts
              </Text>
              {activeAlerts.slice(0, 10).map((alert, i) => (
                <Row key={i} style={{ marginBottom: "6px" }}>
                  <Column style={{ width: "60px" }}>
                    <Text
                      style={{
                        color:
                          alert.severity === "critical"
                            ? "#f87171"
                            : alert.severity === "warning"
                              ? "#eab308"
                              : "#60a5fa",
                        fontSize: "10px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        margin: "0",
                      }}
                    >
                      {alert.severity}
                    </Text>
                  </Column>
                  <Column>
                    <Text
                      style={{ color: "#e5e7eb", fontSize: "13px", margin: "0" }}
                    >
                      {alert.message}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>
          )}

          {activeAlerts.length === 0 && (
            <Section>
              <Text style={{ color: "#6b7280", fontSize: "13px" }}>
                No active alerts.
              </Text>
            </Section>
          )}

          <Hr style={{ borderColor: "#374151", margin: "16px 0" }} />

          {/* Briefing narrative */}
          <Section>
            <Text
              style={{
                color: "#9ca3af",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: "0 0 8px",
              }}
            >
              Briefing
            </Text>
            <Text
              style={{
                color: "#d1d5db",
                fontSize: "13px",
                lineHeight: "1.6",
              }}
            >
              {briefingNarrative ||
                "No briefing narrative available for this period."}
            </Text>
          </Section>

          <Hr style={{ borderColor: "#374151", margin: "16px 0" }} />
          <Text
            style={{
              color: "#6b7280",
              fontSize: "10px",
              textAlign: "center",
            }}
          >
            CodePulse — Ástríðr Operational Dashboard
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
