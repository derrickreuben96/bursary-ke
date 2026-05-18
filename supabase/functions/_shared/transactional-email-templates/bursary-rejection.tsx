import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Bursary KE'
const BRAND_GREEN = '#006600'

interface RejectionProps {
  applicantName?: string
  trackingNumber?: string
  county?: string
  nextCycleNote?: string
  trackUrl?: string
}

const BursaryRejectionEmail = ({
  applicantName,
  trackingNumber,
  county,
  nextCycleNote,
  trackUrl,
}: RejectionProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Update on your bursary application{trackingNumber ? ` (${trackingNumber})` : ''}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>
            {applicantName ? `Dear ${applicantName},` : 'Dear applicant,'}
          </Heading>
          <Text style={subtle}>
            Thank you for applying for support through {SITE_NAME}.
          </Text>
        </Section>

        <Section style={card}>
          <Text style={text}>
            After careful review, your application
            {trackingNumber ? (
              <> (<span style={mono}>{trackingNumber}</span>)</>
            ) : null}{' '}
            was <strong>not selected</strong> in this funding cycle
            {county ? ` for ${county} County` : ''}. Demand exceeded the available
            budget and a limited number of beneficiaries could be supported.
          </Text>

          <Hr style={hr} />

          <Text style={text}>
            <strong>What happens next</strong>
          </Text>
          <Text style={text}>
            {nextCycleNote ||
              'Your application history is saved. When the next cycle opens, you will receive a small priority boost as a returning applicant. Keep your details accurate and consistent to strengthen future applications.'}
          </Text>
        </Section>

        <Section style={ctaWrap}>
          {trackUrl ? (
            <Button href={trackUrl} style={button}>View your application</Button>
          ) : null}
        </Section>

        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BursaryRejectionEmail,
  subject: (d: Record<string, any>) =>
    `Update on your bursary application${d?.trackingNumber ? ` (${d.trackingNumber})` : ''}`,
  displayName: 'Bursary application — not selected',
  previewData: {
    applicantName: 'Jane',
    trackingNumber: 'BKE-X9Y8Z7',
    county: 'Nairobi',
    trackUrl: 'https://bursaryke.xyz/track',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const header = { borderTop: `4px solid ${BRAND_GREEN}`, paddingTop: '20px' }
const h1 = { fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }
const subtle = { fontSize: '14px', color: '#475569', margin: '0 0 20px' }
const card = {
  border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px',
  backgroundColor: '#f8fafc',
}
const text = { fontSize: '14px', color: '#0f172a', lineHeight: '1.6', margin: '0 0 12px' }
const mono = { fontFamily: 'ui-monospace, Menlo, monospace' }
const hr = { borderColor: '#e2e8f0', margin: '16px 0' }
const ctaWrap = { textAlign: 'center' as const, margin: '24px 0' }
const button = {
  backgroundColor: BRAND_GREEN, color: '#ffffff', padding: '12px 22px',
  borderRadius: '8px', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0', textAlign: 'center' as const }
