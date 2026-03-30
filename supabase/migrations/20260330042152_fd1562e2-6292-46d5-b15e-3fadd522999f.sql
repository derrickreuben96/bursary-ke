-- Re-clean and re-seed for proper test with household_dependents fix
DELETE FROM fairness_audit_log WHERE application_id IN (SELECT id FROM bursary_applications WHERE parent_national_id = '99887766');
DELETE FROM fairness_tracking WHERE national_id = '99887766';

INSERT INTO fairness_tracking (national_id, application_id, previous_attempts_count, previous_funded_count,
  historical_status, fraud_risk_level, fairness_priority_score, previous_poverty_score, previous_household_size, data_consistency_score)
VALUES ('99887766', '14c4e4a8-f88a-4281-9989-c3d6b7c0a797', 1, 0, 'returning_unfunded', 'low', 5, 85, 8, 100);

-- Also reset the bursary_applications fairness fields
UPDATE bursary_applications SET fairness_priority_score = 0, is_fairness_priority = false, fraud_risk_level = 'low', historical_status = 'new'
WHERE parent_national_id = '99887766';