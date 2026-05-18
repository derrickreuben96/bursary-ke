/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as seoRegressionAlert } from './seo-regression-alert.tsx'
import { template as bursaryAllocation } from './bursary-allocation.tsx'
import { template as bursaryRejection } from './bursary-rejection.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'seo-regression-alert': seoRegressionAlert,
  'bursary-allocation': bursaryAllocation,
  'bursary-rejection': bursaryRejection,
}
