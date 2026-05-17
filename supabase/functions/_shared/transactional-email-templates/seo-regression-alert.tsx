import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Bursary-KE'

interface SeoRegressionAlertProps {
  url?: string
  scores?: {
    performance?: number | null
    accessibility?: number | null
    best_practices?: number | null
    seo?: number | null
  }
  reasons?: string[]
  richIssues?: Array<{ block: number; message: string }>
}

const SeoRegressionAlertEmail = ({
  url = 'https://www.bursaryke.xyz/',
  scores = {},
  reasons = [],
  richIssues = [],
}: SeoRegressionAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>SEO regression detected on {url}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>SEO regression detected</Heading>
        <Text style={text}>
          The automated audit for <strong>{url}</strong> flagged a regression.
        </Text>

        <Section style={scoreBox}>
          <Text style={scoreRow}>Performance: <strong>{fmt(scores.performance)}</strong></Text>
          <Text style={scoreRow}>Accessibility: <strong>{fmt(scores.accessibility)}</strong></Text>
          <Text style={scoreRow}>Best Practices: <strong>{fmt(scores.best_practices)}</strong></Text>
          <Text style={scoreRow}>SEO: <strong>{fmt(scores.seo)}</strong></Text>
        </Section>

        {reasons.length > 0 && (
          <Section>
            <Heading as="h2" style={h2}>Reasons</Heading>
            {reasons.map((r, i) => (
              <Text key={i} style={listItem}>• {r}</Text>
            ))}
          </Section>
        )}

        {richIssues.length > 0 && (
          <Section>
            <Heading as="h2" style={h2}>Structured data issues</Heading>
            {richIssues.map((issue, i) => (
              <Text key={i} style={listItem}>• {issue.message}</Text>
            ))}
          </Section>
        )}

        <Text style={footer}>
          Review the latest run in the Ops & Reliability dashboard, or check
          GitHub Actions for the failed CI run. — {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

const fmt = (v: number | null | undefined) =>
  typeof v === 'number' ? String(v) : 'n/a'

export const template = {
  component: SeoRegressionAlertEmail,
  subject: (data: Record<string, any>) =>
    `[SEO regression] ${data?.url ?? 'site'} — audit failed`,
  displayName: 'SEO regression alert',
  previewData: {
    url: 'https://www.bursaryke.xyz/',
    scores: { performance: 72, accessibility: 95, best_practices: 92, seo: 88 },
    reasons: ['Performance score 72 < 90', 'SEO score 88 < 90'],
    richIssues: [{ block: 1, message: 'block 1: FAQPage missing mainEntity[]' }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#D21034', margin: '0 0 16px' }
const h2 = { fontSize: '16px', fontWeight: 'bold', color: '#006600', margin: '20px 0 8px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.5', margin: '0 0 16px' }
const scoreBox = { backgroundColor: '#f5f7fa', borderRadius: '8px', padding: '16px', margin: '8px 0 16px' }
const scoreRow = { fontSize: '14px', color: '#333', margin: '4px 0' }
const listItem = { fontSize: '14px', color: '#444', margin: '4px 0' }
const footer = { fontSize: '12px', color: '#888', margin: '24px 0 0' }
