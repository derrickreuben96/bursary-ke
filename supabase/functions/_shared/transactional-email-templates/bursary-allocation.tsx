import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Bursary KE'
const BRAND_GREEN = '#006600'
const BRAND_RED = '#D21034'

interface AllocationProps {
  applicantName?: string
  trackingNumber?: string
  studentName?: string
  institutionName?: string
  allocatedAmount?: number
  county?: string
  trackUrl?: string
}

const formatKES = (n?: number) =>
  typeof n === 'number' ? `KES ${n.toLocaleString('en-KE')}` : 'KES —'

const BursaryAllocationEmail = ({
  applicantName,
  trackingNumber,
  studentName,
  institutionName,
  allocatedAmount,
  county,
  trackUrl,
}: AllocationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Your bursary application has been approved
      {trackingNumber ? ` (${trackingNumber})` : ''}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>Congratulations{applicantName ? `, ${applicantName}` : ''}!</Heading>
          <Text style={subtle}>Your bursary application has been approved.</Text>
        </Section>

        <Section style={card}>
          <Text style={label}>Amount allocated</Text>
          <Heading style={amount}>{formatKES(allocatedAmount)}</Heading>

          <Hr style={hr} />

          <Row label="Tracking number" value={trackingNumber} mono />
          <Row label="Beneficiary" value={studentName} />
          <Row label="Institution" value={institutionName} />
          <Row label="County" value={county} />
        </Section>

        <Section style={ctaWrap}>
          {trackUrl ? (
            <Button href={trackUrl} style={button}>Track your application</Button>
          ) : null}
          <Text style={text}>
            Funds will be disbursed to the institution by your County Treasury. You may
            receive an SMS confirmation once disbursement is complete.
          </Text>
        </Section>

        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label: l, value, mono }: { label: string; value?: string; mono?: boolean }) => (
  <Section style={{ margin: '8px 0' }}>
    <Text style={rowLabel}>{l}</Text>
    <Text style={mono ? rowValueMono : rowValue}>{value || '—'}</Text>
  </Section>
)

export const template = {
  component: BursaryAllocationEmail,
  subject: (d: Record<string, any>) =>
    `Approved: Your bursary application${d?.trackingNumber ? ` (${d.trackingNumber})` : ''}`,
  displayName: 'Bursary allocation (approved)',
  previewData: {
    applicantName: 'Jane',
    trackingNumber: 'BKE-A1B2C3',
    studentName: 'John D***',
    institutionName: 'Alliance High School',
    allocatedAmount: 50000,
    county: 'Nairobi',
    trackUrl: 'https://bursaryke.xyz/track',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const header = { borderTop: `4px solid ${BRAND_GREEN}`, paddingTop: '20px' }
const h1 = { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }
const subtle = { fontSize: '14px', color: '#475569', margin: '0 0 20px' }
const card = {
  border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px',
  backgroundColor: '#f8fafc',
}
const label = { fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#64748b', margin: 0 }
const amount = { fontSize: '32px', fontWeight: 700, color: BRAND_GREEN, margin: '4px 0 0' }
const hr = { borderColor: '#e2e8f0', margin: '16px 0' }
const rowLabel = { fontSize: '12px', color: '#64748b', margin: 0 }
const rowValue = { fontSize: '14px', color: '#0f172a', margin: '2px 0 0', fontWeight: 500 }
const rowValueMono = { ...rowValue, fontFamily: 'ui-monospace, Menlo, monospace' }
const ctaWrap = { textAlign: 'center' as const, margin: '24px 0' }
const button = {
  backgroundColor: BRAND_GREEN, color: '#ffffff', padding: '12px 22px',
  borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
}
const text = { fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: '16px 0 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0', textAlign: 'center' as const }
