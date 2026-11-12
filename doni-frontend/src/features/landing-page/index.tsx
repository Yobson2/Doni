import { MotionConfig } from 'framer-motion'
import { ProductSection } from './components/product-section'
import {
  Faq,
  FinalCta,
  Hero,
  HowItWorks,
  Problem,
  Trust,
} from './components/sections'

// Copy lives in src/i18n/{en,fr}.json under `landing.*`.
// Story: what it is (hero) → why (problem) → what it does (product, with a live
// calculator) → how (steps) → why trust it (data) → questions → next step.
export default function LandingPage() {
  return (
    <MotionConfig reducedMotion='user'>
      <Hero />
      <Problem />
      <ProductSection />
      <HowItWorks />
      <Trust />
      <Faq />
      <FinalCta />
    </MotionConfig>
  )
}
