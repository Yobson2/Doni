import { LazyMotion, MotionConfig } from 'framer-motion'
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
const loadMotionFeatures = () =>
  import('./motion-features').then((m) => m.default)

export default function LandingPage() {
  return (
    // LazyMotion: the animation features load after the page has painted,
    // keeping them out of the first-load JavaScript budget (ADR 0010).
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion='user'>
        <Hero />
        <Problem />
        <ProductSection />
        <HowItWorks />
        <Trust />
        <Faq />
        <FinalCta />
      </MotionConfig>
    </LazyMotion>
  )
}
