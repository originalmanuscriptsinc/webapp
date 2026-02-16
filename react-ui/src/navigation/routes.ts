import { FC } from 'react'
import { WelcomeContainer } from '../screens/Welcome/WelcomeContainer'

export interface Route {
    path: string
    component: FC
    exact: boolean
}

export const Routes: Route[] = [
    {
        path: '/',
        component: WelcomeContainer as FC<unknown>,
        exact: true,
    },
]
