import React, { FC, ReactNode } from 'react'
import { IntlProvider } from 'react-intl'

interface ProvidersProps {
    children: ReactNode
}

export const Providers: FC<ProvidersProps> = ({ children }) => {
    return <IntlProvider locale="en">{children}</IntlProvider>
}
