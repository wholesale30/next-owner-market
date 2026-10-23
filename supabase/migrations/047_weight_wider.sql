-- Big lots (60 pallet-rack uprights + 250 beams) weigh over 9,999 lbs; the old column (6,2) made those listings fail to save (Oct 23, 2026).
alter table items alter column weight_lbs type numeric(9,2);
