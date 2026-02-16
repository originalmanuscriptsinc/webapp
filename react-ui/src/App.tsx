import React, { FC } from 'react'
import { Providers } from './Providers'
import { Router } from './navigation/Router'

export const App: FC = () => {
    return (
        <Providers>
            <Router />
        </Providers>
    )
}
