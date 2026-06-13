'use client'
import { createContext, useContext } from 'react'
import type { AdminUser } from './use-admin-auth'

export const CoordinatorCtx = createContext<AdminUser | null>(null)
export const useCoordinator = () => useContext(CoordinatorCtx)
