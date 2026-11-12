import { Trans } from 'react-i18next'

const linkClass = 'hover:text-primary underline underline-offset-4'

/** "By continuing you agree to the Terms and Privacy Policy" line under auth forms. */
export function LegalNotice({ i18nKey }: { i18nKey: string }) {
  return (
    <p className='text-muted-foreground px-8 text-center text-sm'>
      <Trans
        i18nKey={i18nKey}
        components={{
          terms: <a href='/terms' className={linkClass} />,
          privacy: <a href='/privacy' className={linkClass} />,
        }}
      />
    </p>
  )
}
