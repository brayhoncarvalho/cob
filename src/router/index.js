import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from '@/stores/auth.js'

// Lazy-loaded views
const LoginView            = () => import('@/views/LoginView.vue')
const DashboardView        = () => import('@/views/client/DashboardView.vue')
const ContractsListView    = () => import('@/views/client/ContractsListView.vue')
const ContractDetailView   = () => import('@/views/client/ContractDetailView.vue')
const PaymentView          = () => import('@/views/client/PaymentView.vue')
const AnticipationView     = () => import('@/views/client/AnticipationView.vue')
const NegotiationView      = () => import('@/views/client/NegotiationView.vue')
const ProposalResultView   = () => import('@/views/client/ProposalResultView.vue')
const MyNegotiationsView   = () => import('@/views/client/MyNegotiationsView.vue')
const AgreementDetailView  = () => import('@/views/client/AgreementDetailView.vue')

const ApprovalQueueView    = () => import('@/views/backoffice/ApprovalQueueView.vue')
const ProposalAnalysisView = () => import('@/views/backoffice/ProposalAnalysisView.vue')
const ManagerDashboardView = () => import('@/views/backoffice/ManagerDashboardView.vue')
const ManagerAnalysisView  = () => import('@/views/backoffice/ManagerAnalysisView.vue')

const routes = [
  { path: '/', redirect: '/login' },

  // Pública
  { path: '/login', component: LoginView, meta: { public: true } },

  // Cliente
  { path: '/dashboard',                      component: DashboardView,       meta: { requiresAuth: true, role: 'client' } },
  { path: '/contratos',                      component: ContractsListView,   meta: { requiresAuth: true, role: 'client' } },
  { path: '/contratos/:id',                  component: ContractDetailView,  meta: { requiresAuth: true, role: 'client' } },
  { path: '/contratos/:id/pagar',            component: PaymentView,         meta: { requiresAuth: true, role: 'client' } },
  { path: '/contratos/:id/antecipar',        component: AnticipationView,    meta: { requiresAuth: true, role: 'client' } },
  { path: '/contratos/:id/negociar',         component: NegotiationView,     meta: { requiresAuth: true, role: 'client' } },
  { path: '/proposta/resultado',             component: ProposalResultView,  meta: { requiresAuth: true, role: 'client' } },
  { path: '/negociacoes',                    component: MyNegotiationsView,  meta: { requiresAuth: true, role: 'client' } },
  { path: '/negociacoes/:id',                component: AgreementDetailView, meta: { requiresAuth: true, role: 'client' } },

  // Back-office — Analista (1º Nível)
  { path: '/backoffice/fila',                component: ApprovalQueueView,    meta: { requiresAuth: true, role: 'analyst' } },
  { path: '/backoffice/proposta/:id',        component: ProposalAnalysisView, meta: { requiresAuth: true, role: 'analyst' } },

  // Back-office — Gerente (2º Nível)
  { path: '/backoffice/gerente',             component: ManagerDashboardView, meta: { requiresAuth: true, role: 'manager' } },
  { path: '/backoffice/gerente/proposta/:id',component: ManagerAnalysisView,  meta: { requiresAuth: true, role: 'manager' } },

  // Fallback
  { path: '/:pathMatch(.*)*', redirect: '/login' },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to, _from, next) => {
  const { state } = useAuth()

  if (to.meta.public) {
    // Redireciona usuário já logado para sua home
    if (state.isAuthenticated) {
      const home = roleHome(state.role)
      return next(home)
    }
    return next()
  }

  if (!state.isAuthenticated) {
    return next('/login')
  }

  if (to.meta.role && to.meta.role !== state.role) {
    return next(roleHome(state.role))
  }

  next()
})

function roleHome(role) {
  if (role === 'analyst')  return '/backoffice/fila'
  if (role === 'manager')  return '/backoffice/gerente'
  return '/dashboard'
}

export default router
