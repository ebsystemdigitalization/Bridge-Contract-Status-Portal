import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContractDocId, validateContractPayload } from './contracts.js';

test('validateContractPayload rejects malformed or unsupported contract payloads', () => {
  assert.equal(validateContractPayload({
    billingAccountNumber: 'BA-1',
    msisdn: '60123456789',
    contractStatus: 'ACTIVE',
    planName: 'Plan',
    productName: 'Product'
  }), true);

  assert.equal(validateContractPayload({
    billingAccountNumber: 'BA-1',
    msisdn: '60123456789',
    contractStatus: 'PENDING',
    planName: 'Plan',
    productName: 'Product'
  }), false);
});

test('buildContractDocId sanitizes values into a safe document id', () => {
  const docId = buildContractDocId({
    msisdn: '60123456789',
    billingAccountNumber: 'BA/1',
    productName: 'Prod 1',
    contractName: 'Contract #1',
    contractStartDate: '2024-01-01',
    contractEndDate: '2025-01-01',
    contractDuration: '12m',
    contractPenaltyAmount: '100.00',
    segment: 'SME'
  });

  assert.equal(docId, '60123456789_BA_1_Prod_1_Contract__1_2024-01-01_2025-01-01_12m_100.00_SME');
});
