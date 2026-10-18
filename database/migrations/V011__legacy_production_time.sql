-- V007 used the known receipt time as a legacy surrogate. It is not evidence of production.
-- Retain dates recorded by an actual RECEIVE command; expose unknown historical production as NULL.
UPDATE fm_inventory_batch
 SET produced_at=NULL
 WHERE produced_at=received_at
   AND NOT EXISTS (
     SELECT 1 FROM fm_inventory_movement m
      WHERE m.batch_id=fm_inventory_batch.batch_id AND m.type='RECEIVE'
   );
