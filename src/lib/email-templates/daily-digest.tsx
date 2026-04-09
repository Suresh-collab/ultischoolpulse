import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Heading,
} from "@react-email/components";

type HomeworkItem = {
  subject: string;
  description: string;
  dueDate: string;
};

type ExamItem = {
  subject: string;
  examType: string;
  examDate: string;
  portions: string[];
};

type ChildDigest = {
  childName: string;
  homework: HomeworkItem[];
  exams: ExamItem[];
};

type DailyDigestEmailProps = {
  parentName: string;
  dateDisplay: string;
  children: ChildDigest[];
  appUrl: string;
  unsubscribeUrl: string;
};

export function DailyDigestEmail({
  parentName,
  dateDisplay,
  children,
  appUrl,
  unsubscribeUrl,
}: DailyDigestEmailProps) {
  const hasAnyContent = children.some(
    (c) => c.homework.length > 0 || c.exams.length > 0
  );

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>ULTISchoolPulse</Text>
            <Text style={dateText}>{dateDisplay}</Text>
          </Section>

          <Section style={content}>
            <Text style={greeting}>Hi {parentName},</Text>

            {!hasAnyContent ? (
              <Text style={bodyText}>
                All clear today — no homework or exams on record. Enjoy the
                break!
              </Text>
            ) : (
              children.map((child, ci) => (
                <Section key={ci} style={childSection}>
                  <Heading as="h2" style={childHeading}>
                    {child.childName}
                  </Heading>

                  {/* Homework */}
                  {child.homework.length > 0 && (
                    <>
                      <Text style={sectionLabel}>Homework</Text>
                      {groupBySubject(child.homework).map(
                        ([subject, items]) => (
                          <Section key={subject} style={subjectGroup}>
                            <Text style={subjectName}>{subject}</Text>
                            {items.map((hw, i) => (
                              <Text key={i} style={listItem}>
                                &bull; {hw.description}
                                {hw.dueDate ? ` (due ${hw.dueDate})` : ""}
                              </Text>
                            ))}
                          </Section>
                        )
                      )}
                    </>
                  )}

                  {child.homework.length === 0 && (
                    <Text style={emptyText}>No homework today.</Text>
                  )}

                  {/* Exams */}
                  {child.exams.length > 0 && (
                    <>
                      <Text style={sectionLabel}>Upcoming Exams (7 days)</Text>
                      {child.exams.map((exam, i) => (
                        <Section key={i} style={examBlock}>
                          <Text style={examTitle}>
                            {exam.subject} — {exam.examType} on {exam.examDate}
                          </Text>
                          {exam.portions.length > 0 && (
                            <Text style={portionsText}>
                              Portions: {exam.portions.join(", ")}
                            </Text>
                          )}
                        </Section>
                      ))}
                    </>
                  )}

                  {ci < children.length - 1 && <Hr style={divider} />}
                </Section>
              ))
            )}

            <Section style={ctaSection}>
              <Link href={appUrl} style={ctaLink}>
                Open Dashboard
              </Link>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={unsubscribeLink}>
                Unsubscribe
              </Link>{" "}
              from daily digest emails
            </Text>
            <Text style={footerText}>
              ULTISchoolPulse — Stop reading PDFs, start knowing what matters.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function groupBySubject(
  items: HomeworkItem[]
): [string, HomeworkItem[]][] {
  const map = new Map<string, HomeworkItem[]>();
  for (const item of items) {
    const existing = map.get(item.subject) ?? [];
    existing.push(item);
    map.set(item.subject, existing);
  }
  return Array.from(map.entries());
}

// Inline styles for email compatibility
const main = {
  backgroundColor: "#F8FAFA",
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const container = {
  margin: "0 auto",
  maxWidth: "560px",
};

const header = {
  backgroundColor: "#0F7B6C",
  padding: "24px 32px",
  borderRadius: "12px 12px 0 0",
};

const logo = {
  color: "#FFFFFF",
  fontSize: "20px",
  fontWeight: "700" as const,
  margin: "0",
};

const dateText = {
  color: "#E6F4F2",
  fontSize: "14px",
  margin: "4px 0 0 0",
};

const content = {
  backgroundColor: "#FFFFFF",
  padding: "24px 32px",
};

const greeting = {
  fontSize: "16px",
  color: "#111827",
  margin: "0 0 16px 0",
};

const bodyText = {
  fontSize: "14px",
  color: "#6B7280",
  lineHeight: "1.5",
};

const childSection = {
  marginBottom: "16px",
};

const childHeading = {
  fontSize: "18px",
  fontWeight: "600" as const,
  color: "#111827",
  margin: "0 0 12px 0",
};

const sectionLabel = {
  fontSize: "13px",
  fontWeight: "600" as const,
  color: "#0F7B6C",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "12px 0 8px 0",
};

const subjectGroup = {
  marginBottom: "8px",
};

const subjectName = {
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#111827",
  margin: "0 0 4px 0",
};

const listItem = {
  fontSize: "14px",
  color: "#374151",
  margin: "2px 0 2px 8px",
  lineHeight: "1.5",
};

const emptyText = {
  fontSize: "14px",
  color: "#9CA3AF",
  fontStyle: "italic" as const,
  margin: "4px 0",
};

const examBlock = {
  marginBottom: "8px",
  paddingLeft: "8px",
  borderLeft: "3px solid #F59F00",
};

const examTitle = {
  fontSize: "14px",
  fontWeight: "600" as const,
  color: "#111827",
  margin: "0 0 2px 0",
};

const portionsText = {
  fontSize: "13px",
  color: "#6B7280",
  margin: "0",
};

const divider = {
  borderColor: "#E5E7EB",
  margin: "16px 0",
};

const ctaSection = {
  textAlign: "center" as const,
  marginTop: "24px",
};

const ctaLink = {
  backgroundColor: "#0F7B6C",
  color: "#FFFFFF",
  padding: "10px 24px",
  borderRadius: "8px",
  fontSize: "14px",
  fontWeight: "600" as const,
  textDecoration: "none",
  display: "inline-block",
};

const footer = {
  backgroundColor: "#F8FAFA",
  padding: "16px 32px",
  borderRadius: "0 0 12px 12px",
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "12px",
  color: "#9CA3AF",
  margin: "4px 0",
};

const unsubscribeLink = {
  color: "#6B7280",
  textDecoration: "underline",
};

export default DailyDigestEmail;
