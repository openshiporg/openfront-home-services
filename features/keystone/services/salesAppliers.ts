import { registerApplier } from '../lib/approvalAppliers'
import { applyPriceBookPublish } from './pricebook'
import { applyEstimateDiscount } from './estimates'
import './cancellation'

/*
 * Approval appliers for Phase 2 (STATE-MACHINES §0): each runs in the approval's transaction, after
 * consumeApproval has matched the approved payload hash, and re-checks the target against the payload.
 */
registerApplier('pricebook.publish', (uow, actor, request) => applyPriceBookPublish(uow, actor, request))
registerApplier('estimate.discount', (uow, actor, request) => applyEstimateDiscount(uow, actor, request))
