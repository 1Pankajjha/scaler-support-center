/**
 * Single Vercel serverless entry-point for all /api/* routes.
 * Consolidates 29 route handlers into one function to stay within
 * the Vercel Hobby plan's 12-function limit.
 *
 * Vercel populates path params in req.query (e.g. ?id=123).
 * Express populates them in req.params. The `mount` helper copies
 * req.params → req.query so existing handlers work unchanged.
 */
import express, { Request, Response } from 'express'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Route handlers ──────────────────────────────────────────────────────────
import meHandler from './_v1/me'
import linksIndexHandler from './_v1/links/index'
import linksExportHandler from './_v1/links/export'
import linkByIdHandler from './_v1/links/[id]'
import employeesIndexHandler from './_v1/employees/index'
import employeeByIdHandler from './_v1/employees/[id]'
import gatewaysStatusHandler from './_v1/gateways/status'
import gatewaysIndexHandler from './_v1/gateways/index'
import gatewayByProviderHandler from './_v1/gateways/[provider]/index'
import gatewayActivateHandler from './_v1/gateways/[provider]/activate'
import invitationsIndexHandler from './_v1/invitations/index'
import invitationByIdHandler from './_v1/invitations/[id]'
import invitationResendHandler from './_v1/invitations/[id]/resend'
import invitationRevokeHandler from './_v1/invitations/[id]/revoke'
import usersIndexHandler from './_v1/users/index'
import userResetPasswordHandler from './_v1/users/[id]/reset-password'
import userRoleHandler from './_v1/users/[id]/role'
import userStatusHandler from './_v1/users/[id]/status'
import settingsDomainsIndexHandler from './_v1/settings/domains/index'
import settingsDomainByIdHandler from './_v1/settings/domains/[id]'
import settingsRulesIndexHandler from './_v1/settings/rules/index'
import settingsRuleByIdHandler from './_v1/settings/rules/[id]'
import dashboardStatsHandler from './_v1/dashboard/stats'
import dashboardTopEmployeesHandler from './_v1/dashboard/top-employees'
import dashboardCollectionsByTypeHandler from './_v1/dashboard/collections-by-type'
import auditHandler from './_v1/audit/index'
import authCallbackHandler from './_v1/auth/callback'
import webhookPayuHandler from './_public/webhooks/payu'
import webhookRazorpayHandler from './_public/webhooks/razorpay'
import webhookStripeHandler from './_public/webhooks/stripe'

// ── App setup ───────────────────────────────────────────────────────────────
const app = express()
app.use(express.json())
app.use(express.text())
app.use(express.urlencoded({ extended: true }))

type Handler = (req: VercelRequest, res: VercelResponse) => unknown

/**
 * Register a route and bridge Express path params → req.query
 * so that handlers using `req.query.id` still work correctly.
 *
 * NOTE: req.query may be a read-only getter in some runtimes (Vercel Node).
 * We use Object.defineProperty to safely override it.
 */
function mount(path: string, handler: Handler) {
  app.all(path, (req: Request, res: Response) => {
    const merged = { ...req.query, ...req.params }
    try {
      req.query = merged
    } catch {
      // req.query is read-only (e.g. Vercel runtime) — override with defineProperty
      Object.defineProperty(req, 'query', {
        value: merged,
        writable: true,
        configurable: true,
      })
    }
    return handler(req as unknown as VercelRequest, res as unknown as VercelResponse)
  })
}

// ── Route registration (static before dynamic at each level) ────────────────

// Auth
mount('/api/v1/auth/callback', authCallbackHandler)

// Me
mount('/api/v1/me', meHandler)

// Links — export must be registered before :id
mount('/api/v1/links/export', linksExportHandler)
mount('/api/v1/links/:id', linkByIdHandler)
mount('/api/v1/links', linksIndexHandler)

// Employees
mount('/api/v1/employees/:id', employeeByIdHandler)
mount('/api/v1/employees', employeesIndexHandler)

// Gateways — status must be registered before :provider
mount('/api/v1/gateways/status', gatewaysStatusHandler)
mount('/api/v1/gateways/:provider/activate', gatewayActivateHandler)
mount('/api/v1/gateways/:provider', gatewayByProviderHandler)
mount('/api/v1/gateways', gatewaysIndexHandler)

// Invitations
mount('/api/v1/invitations/:id/resend', invitationResendHandler)
mount('/api/v1/invitations/:id/revoke', invitationRevokeHandler)
mount('/api/v1/invitations/:id', invitationByIdHandler)
mount('/api/v1/invitations', invitationsIndexHandler)

// Users
mount('/api/v1/users/:id/reset-password', userResetPasswordHandler)
mount('/api/v1/users/:id/role', userRoleHandler)
mount('/api/v1/users/:id/status', userStatusHandler)
mount('/api/v1/users', usersIndexHandler)

// Settings
mount('/api/v1/settings/domains/:id', settingsDomainByIdHandler)
mount('/api/v1/settings/domains', settingsDomainsIndexHandler)
mount('/api/v1/settings/rules/:id', settingsRuleByIdHandler)
mount('/api/v1/settings/rules', settingsRulesIndexHandler)

// Dashboard
mount('/api/v1/dashboard/stats', dashboardStatsHandler)
mount('/api/v1/dashboard/top-employees', dashboardTopEmployeesHandler)
mount('/api/v1/dashboard/collections-by-type', dashboardCollectionsByTypeHandler)

// Audit
mount('/api/v1/audit/export', auditHandler)
mount('/api/v1/audit', auditHandler)

// Public webhooks
mount('/api/public/webhooks/payu', webhookPayuHandler)
mount('/api/public/webhooks/razorpay', webhookRazorpayHandler)
mount('/api/public/webhooks/stripe', webhookStripeHandler)

export default app
