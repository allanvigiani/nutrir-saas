-- ============================================================
-- ROW LEVEL SECURITY — Nutrir SaaS
-- Aplicar APÓS as mudanças de código (Tasks 3-6)
-- ============================================================

-- PATIENTS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;

CREATE POLICY patients_nutritionist ON patients FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY patients_self ON patients FOR SELECT
  USING (id = current_setting('app.current_patient_id', true));

CREATE POLICY patients_admin ON patients FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- CONSULTATIONS
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations FORCE ROW LEVEL SECURITY;

CREATE POLICY consultations_nutritionist ON consultations FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY consultations_patient ON consultations FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY consultations_admin ON consultations FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- LAB_EXAMS (sem nutritionistId direto — JOIN via patients)
ALTER TABLE lab_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_exams FORCE ROW LEVEL SECURITY;

CREATE POLICY lab_exams_nutritionist ON lab_exams FOR ALL
  USING (EXISTS (
    SELECT 1 FROM patients p
    WHERE p.id = lab_exams."patientId"
    AND p."nutritionistId" = current_setting('app.current_nutritionist_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM patients p
    WHERE p.id = lab_exams."patientId"
    AND p."nutritionistId" = current_setting('app.current_nutritionist_id', true)
  ));

CREATE POLICY lab_exams_patient ON lab_exams FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY lab_exams_admin ON lab_exams FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- MEAL_PLANS
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans FORCE ROW LEVEL SECURITY;

CREATE POLICY meal_plans_nutritionist ON meal_plans FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY meal_plans_patient ON meal_plans FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY meal_plans_admin ON meal_plans FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- MEAL_PLAN_ITEMS (sem nutritionistId/patientId — JOIN via meal_plans)
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_items FORCE ROW LEVEL SECURITY;

CREATE POLICY meal_plan_items_nutritionist ON meal_plan_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM meal_plans mp
    WHERE mp.id = meal_plan_items."mealPlanId"
    AND mp."nutritionistId" = current_setting('app.current_nutritionist_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM meal_plans mp
    WHERE mp.id = meal_plan_items."mealPlanId"
    AND mp."nutritionistId" = current_setting('app.current_nutritionist_id', true)
  ));

CREATE POLICY meal_plan_items_patient ON meal_plan_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM meal_plans mp
    WHERE mp.id = meal_plan_items."mealPlanId"
    AND mp."patientId" = current_setting('app.current_patient_id', true)
  ));

CREATE POLICY meal_plan_items_admin ON meal_plan_items FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- APPOINTMENTS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

CREATE POLICY appointments_nutritionist ON appointments FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY appointments_patient ON appointments FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY appointments_admin ON appointments FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- NUTRITION_CALCULATIONS
ALTER TABLE nutrition_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_calculations FORCE ROW LEVEL SECURITY;

CREATE POLICY nutrition_calculations_nutritionist ON nutrition_calculations FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY nutrition_calculations_patient ON nutrition_calculations FOR SELECT
  USING ("patientId" = current_setting('app.current_patient_id', true));

CREATE POLICY nutrition_calculations_admin ON nutrition_calculations FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- CUSTOM_FOODS
ALTER TABLE custom_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_foods FORCE ROW LEVEL SECURITY;

CREATE POLICY custom_foods_nutritionist ON custom_foods FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY custom_foods_admin ON custom_foods FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

CREATE POLICY payments_nutritionist ON payments FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY payments_admin ON payments FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- SUBSCRIPTIONS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_nutritionist ON subscriptions FOR ALL
  USING ("nutritionistId" = current_setting('app.current_nutritionist_id', true))
  WITH CHECK ("nutritionistId" = current_setting('app.current_nutritionist_id', true));

CREATE POLICY subscriptions_admin ON subscriptions FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');

-- NUTRITIONISTS
ALTER TABLE nutritionists ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutritionists FORCE ROW LEVEL SECURITY;

CREATE POLICY nutritionists_self ON nutritionists FOR ALL
  USING (id = current_setting('app.current_nutritionist_id', true))
  WITH CHECK (id = current_setting('app.current_nutritionist_id', true));

CREATE POLICY nutritionists_admin ON nutritionists FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'true')
  WITH CHECK (current_setting('app.rls_bypass', true) = 'true');
