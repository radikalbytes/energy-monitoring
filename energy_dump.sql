PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE energy_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL,
    irms REAL NOT NULL,
    power REAL NOT NULL,
    temperature REAL NOT NULL,
    humidity REAL NOT NULL,
    timestamp INTEGER NOT NULL
  );
INSERT INTO energy_data VALUES(1,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.800000000000000044,414.0799999999999841,5.599999999999999645,95.0,1740333679766);
INSERT INTO energy_data VALUES(2,'c342eafb-dba4-4d7f-8d44-eafd08528743',2.0,460.0400000000000204,5.599999999999999645,95.0,1740333740051);
INSERT INTO energy_data VALUES(3,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.600000000000000088,368.740000000000009,5.599999999999999645,95.0,1740333800319);
INSERT INTO energy_data VALUES(4,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.790000000000000035,411.1200000000000045,5.599999999999999645,95.0,1740333860591);
INSERT INTO energy_data VALUES(5,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.560000000000000053,359.5199999999999819,5.599999999999999645,95.0,1740333934939);
INSERT INTO energy_data VALUES(6,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.550000000000000044,355.5799999999999841,5.599999999999999645,95.0,1740333995227);
INSERT INTO energy_data VALUES(7,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.899999999999999912,438.0299999999999727,5.599999999999999645,95.0,1740334055458);
INSERT INTO energy_data VALUES(8,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.429999999999999938,328.4700000000000273,5.599999999999999645,95.0,1740334115758);
INSERT INTO energy_data VALUES(9,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.629999999999999894,374.3000000000000113,5.599999999999999645,95.0,1740334176059);
INSERT INTO energy_data VALUES(10,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.679999999999999938,385.3799999999999955,5.599999999999999645,95.0,1740336679746);
INSERT INTO energy_data VALUES(11,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.830000000000000071,420.8899999999999864,5.599999999999999645,95.0,1740336706936);
INSERT INTO energy_data VALUES(12,'c342eafb-dba4-4d7f-8d44-eafd08528743',2.040000000000000035,468.1700000000000159,5.599999999999999645,95.0,1740336768230);
INSERT INTO energy_data VALUES(13,'c342eafb-dba4-4d7f-8d44-eafd08528743',2.089999999999999857,481.6700000000000159,5.599999999999999645,95.0,1740336828523);
INSERT INTO energy_data VALUES(14,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.469999999999999974,337.9800000000000181,5.599999999999999645,95.0,1740336898911);
INSERT INTO energy_data VALUES(15,'c342eafb-dba4-4d7f-8d44-eafd08528743',2.06999999999999984,476.1800000000000068,5.599999999999999645,95.0,1740336959205);
INSERT INTO energy_data VALUES(16,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.699999999999999956,390.990000000000009,5.599999999999999645,95.0,1740337019466);
INSERT INTO energy_data VALUES(17,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.919999999999999929,441.1899999999999978,5.599999999999999645,95.0,1740337079747);
INSERT INTO energy_data VALUES(18,'c342eafb-dba4-4d7f-8d44-eafd08528743',2.129999999999999894,489.4399999999999978,5.599999999999999645,95.0,1740337141053);
INSERT INTO energy_data VALUES(19,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.360000000000000097,313.410000000000025,6.0,95.0,1740337206961);
INSERT INTO energy_data VALUES(20,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.489999999999999992,341.6700000000000159,6.0,95.0,1740337267226);
INSERT INTO energy_data VALUES(21,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.540000000000000035,354.3100000000000022,6.0,95.0,1740337327490);
INSERT INTO energy_data VALUES(22,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.610000000000000097,369.990000000000009,6.0,95.0,1740337388790);
INSERT INTO energy_data VALUES(23,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.570000000000000062,362.1299999999999955,6.0,95.0,1740337449033);
INSERT INTO energy_data VALUES(24,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.709999999999999965,393.759999999999991,6.0,95.0,1740337509303);
INSERT INTO energy_data VALUES(25,'c342eafb-dba4-4d7f-8d44-eafd08528743',2.140000000000000124,491.8500000000000227,6.0,95.0,1740337590601);
INSERT INTO energy_data VALUES(26,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.590000000000000079,366.0,6.0,95.0,1740337650866);
INSERT INTO energy_data VALUES(27,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.600000000000000088,367.4499999999999887,6.0,95.0,1740337711130);
INSERT INTO energy_data VALUES(28,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.429999999999999938,328.9200000000000159,6.0,95.0,1740337772142);
INSERT INTO energy_data VALUES(29,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.850000000000000088,424.7799999999999727,6.0,95.0,1740337832394);
INSERT INTO energy_data VALUES(30,'c342eafb-dba4-4d7f-8d44-eafd08528743',2.06999999999999984,476.6299999999999955,6.0,95.0,1740337892645);
INSERT INTO energy_data VALUES(31,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.469999999999999974,339.0500000000000113,6.0,95.0,1740337952917);
INSERT INTO energy_data VALUES(32,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.620000000000000106,372.4800000000000181,6.0,95.0,1740338013207);
INSERT INTO energy_data VALUES(33,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.729999999999999983,397.1999999999999887,6.0,95.0,1740338073491);
INSERT INTO energy_data VALUES(34,'c342eafb-dba4-4d7f-8d44-eafd08528743',1.350000000000000088,311.0400000000000204,6.0,95.0,1740338133801);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('energy_data',34);
COMMIT;
