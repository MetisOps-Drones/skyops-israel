-- Same mojibake bug as 0029, but in altitude_text instead of name — the
-- background mojibake-fix task only touched name. Fixed the same way: reverse
-- the Windows-1252 round-trip, verified all 62 affected rows decode to clean text.

update aip_reference_zones set altitude_text = 'GND/SFC – 14,000 ft AMSL' where id = 'b3351545-c8ab-40c5-bc9c-34135b5c12b3'; -- LLD28
update aip_reference_zones set altitude_text = '5,000 – 11,000 ft AMSL' where id = 'ad4878a6-d2cf-4ec3-bd92-e28a4f0ca2f5'; -- LLD29
update aip_reference_zones set altitude_text = 'GND – 4,500 ft AMSL' where id = '3589fdb0-2b5f-4816-ae00-1ac8412c4cff'; -- LLD30
update aip_reference_zones set altitude_text = 'GND – 1,900 ft AMSL' where id = '6ba9574d-c02e-498c-8db2-975402d9abe6'; -- LLD31
update aip_reference_zones set altitude_text = 'GND – 600 ft AMSL' where id = '86647d4d-4402-44d5-a036-71d39ed56ff9'; -- LLD34
update aip_reference_zones set altitude_text = 'GND – 900 ft AMSL' where id = '5d0b28dc-a071-45e1-8974-e24b2c3bd8de'; -- LLD35
update aip_reference_zones set altitude_text = 'GND – 1,900 ft AMSL' where id = '289ef7a6-7e4a-4fa7-9950-fb043c8ef00c'; -- LLD36
update aip_reference_zones set altitude_text = 'GND – 11,000 ft AMSL' where id = '26151c46-a825-4141-a080-2cb91ea1ddf5'; -- LLD37
update aip_reference_zones set altitude_text = 'GND – 11,000 ft AMSL' where id = '6ea878a6-b38d-4dd0-bc22-8c58889b0c14'; -- LLD38
update aip_reference_zones set altitude_text = 'GND – 300 ft AMSL' where id = '96f836b3-85c0-40ce-b63e-83a8f3e3d550'; -- LLD39
update aip_reference_zones set altitude_text = 'GND – 300 ft AMSL' where id = 'c5e9a899-8606-485b-bd80-35b4247a22d5'; -- LLD40
update aip_reference_zones set altitude_text = '2,000 – 8,000 ft AMSL' where id = '173a717e-40a1-44b5-acda-c5c2792b1bcd'; -- LLD41
update aip_reference_zones set altitude_text = 'GND – ‎(-530)‎ ft (מתחת לפני הים)' where id = 'be482937-bcf4-43c3-935e-b250cbfb60b2'; -- LLD42
update aip_reference_zones set altitude_text = 'GND – 2,000 ft AMSL' where id = 'dbb77f65-0b5b-4e64-9f3d-b3b05a2f585b'; -- LLD43
update aip_reference_zones set altitude_text = 'GND – 2,000 ft AMSL' where id = 'c976a054-e695-4f0e-846f-a74e7244b2a8'; -- LLD44
update aip_reference_zones set altitude_text = 'MSL – 500 ft AMSL' where id = '0f32674d-c724-4a8d-9005-e244100568f8'; -- LLD47
update aip_reference_zones set altitude_text = 'GND – 700 ft AMSL (כטב"מ עד 50 מ'' מעפ"ש)' where id = '940742a4-ed79-4e8d-9f4c-8f398939d6f7'; -- LLD48
update aip_reference_zones set altitude_text = 'GND – 800 ft AMSL (כטב"מ עד 20 מ'' מעפ"ש בנ.צ המרכזי)' where id = 'e5431235-456f-48ef-8975-7234ba024949'; -- LLD49
update aip_reference_zones set altitude_text = 'GND – 700 ft · בין 18:00 ל-06:00 בלבד' where id = '2786ae98-941e-4f7f-8ed7-361e7624090b'; -- LLD50
update aip_reference_zones set altitude_text = '4,500 – 7,000 ft AMSL' where id = 'b6ab9d7a-58ed-444f-9be3-f756bdcecc5a'; -- LLD51
update aip_reference_zones set altitude_text = '3,500 – 8,000 ft AMSL' where id = '08833139-b38a-44f0-9a68-6ddda9c3d88c'; -- LLD52
update aip_reference_zones set altitude_text = 'GND – 3,000 ft AMSL' where id = '358699ef-2019-4c0e-8c33-750e900888e4'; -- LLP01
update aip_reference_zones set altitude_text = 'GND – 3,500 ft AMSL' where id = '30577437-e23d-4430-b544-b2ca1c762f52'; -- LLP02
update aip_reference_zones set altitude_text = 'GND/MSL – 3,000 ft AMSL' where id = 'a39e2140-4724-4263-bf6e-7536d317369a'; -- LLP03
update aip_reference_zones set altitude_text = 'GND – 3,000 ft AMSL' where id = '4f679605-5d00-458c-971b-78cc5c318d31'; -- LLP04
update aip_reference_zones set altitude_text = 'GND/SFC – 2,000 ft AMSL' where id = '69e1131d-b0b3-4dae-aac6-a1bb7410906e'; -- LLP05
update aip_reference_zones set altitude_text = 'GND – 2,000 ft AMSL' where id = 'ff023219-1540-45da-b325-92aec986cd77'; -- LLP06
update aip_reference_zones set altitude_text = 'GND/SFC – 2,000 ft AMSL' where id = '5c68fd47-7282-42be-814f-fa914d850231'; -- LLP07
update aip_reference_zones set altitude_text = 'GND – 1,100 ft AMSL' where id = '79e96d08-84d6-4da3-979e-d44b1021853c'; -- LLP08
update aip_reference_zones set altitude_text = 'GND – 1,100 ft AMSL' where id = '2a32a0ba-9687-48cb-84da-6e70218e82bb'; -- LLP09
update aip_reference_zones set altitude_text = 'GND – 900 ft AMSL' where id = 'f8ab78f0-54a2-440d-a230-6ffebe351fa8'; -- LLP10
update aip_reference_zones set altitude_text = 'בכל גובה — לכל כלי הטיס' where id = '13f90c67-871a-443a-98ff-a6fcc0a74574'; -- LLP11
update aip_reference_zones set altitude_text = 'GND – 3,000 ft AMSL' where id = '8ea2de13-8269-4315-bbbb-2a3ccbeda8a0'; -- LLP12
update aip_reference_zones set altitude_text = 'GND – 4,000 ft AMSL' where id = '43abe7a8-aaaa-4fed-95e4-304880e407ab'; -- LLP13
update aip_reference_zones set altitude_text = 'GND – 7,000 ft AMSL' where id = '2b397ced-16ed-44a5-bae1-f5af26b75ca5'; -- LLP14
update aip_reference_zones set altitude_text = 'בכל גובה (GND – UNL)' where id = '0d6d79a1-ccf2-4f45-8d94-c4f87c2fdd82'; -- LLP15
update aip_reference_zones set altitude_text = 'GND – 2,700 ft AMSL' where id = 'e8659c75-daa0-44dc-883e-6f246a0fb8c5'; -- LLP16
update aip_reference_zones set altitude_text = 'בכל גובה (GND – UNL)' where id = 'cdddd90d-1f46-475a-8139-e5f9fe963ee7'; -- LLP19
update aip_reference_zones set altitude_text = 'GND – 2,000 ft AMSL' where id = '65e61d3d-5637-4fd1-80b0-98ce44296372'; -- LLP21
update aip_reference_zones set altitude_text = 'GND – 2,000 ft AMSL' where id = 'e201cd87-ad48-40e9-a6e7-82ca3c3c8499'; -- LLP22
update aip_reference_zones set altitude_text = 'GND – 3,000 ft AMSL' where id = 'b34e7d20-16eb-4f5f-9230-f6f6aedfe29b'; -- LLP23
update aip_reference_zones set altitude_text = 'MSL – 4,000 ft AMSL' where id = '20289d69-c454-4a23-b30e-582273c8b38c'; -- LLP24
update aip_reference_zones set altitude_text = 'MSL – 3,000 ft AMSL' where id = '90a35a20-7e43-42f0-9295-bcd6db65ff8e'; -- LLP25
update aip_reference_zones set altitude_text = 'MSL – 3,000 ft AMSL' where id = '98a4a2a2-e46d-4983-811e-60eb878a1c8e'; -- LLP26
update aip_reference_zones set altitude_text = 'MSL – 800 ft AMSL' where id = '1c06da0f-94b8-4868-b15f-ca7e8f414aa5'; -- LLP27
update aip_reference_zones set altitude_text = 'MSL – 3,000 ft AMSL' where id = 'a006cedf-96e9-451e-9f09-86ebab2d40ec'; -- LLP28
update aip_reference_zones set altitude_text = 'GND – 1,700 ft AMSL' where id = '2f4ee2f9-605b-4fe2-851c-4a62bfbf770c'; -- LLP30
update aip_reference_zones set altitude_text = 'GND – 4,000 ft AMSL' where id = '6312d239-681f-411a-b37f-ba3bbc576cb6'; -- LLP39
update aip_reference_zones set altitude_text = 'GND – 1,100 ft AMSL' where id = 'ec23ed04-b531-402c-ab31-e4fa5eedf097'; -- LLP41
update aip_reference_zones set altitude_text = 'GND – 2,000 ft AMSL' where id = '8726b327-7de7-40a5-926f-7f9546fb8247'; -- LLP42
update aip_reference_zones set altitude_text = 'GND – 2,500 ft AMSL' where id = '45dd1036-6f03-4c24-a1c7-3eaef7ed0d0b'; -- LLP43
update aip_reference_zones set altitude_text = 'GND – 1,500 ft AMSL' where id = '6bab4897-5fd9-42c9-8b39-c43f17336f08'; -- LLP44
update aip_reference_zones set altitude_text = 'בכל גובה (GND – UNL)' where id = 'e49adfe2-a731-4312-8dbf-31d71b7a4873'; -- LLR100
update aip_reference_zones set altitude_text = 'GND/SFC – 12,000 ft AMSL' where id = '0099bd4b-bda1-401f-badc-cee98a756796'; -- LLR20
update aip_reference_zones set altitude_text = 'GND/SFC – 23,000 ft AMSL' where id = '81bc3423-d916-43c7-ae6d-4c616c62b7a9'; -- LLR27
update aip_reference_zones set altitude_text = 'בכל גובה (GND – UNL)' where id = '22787342-3137-40e5-8065-8f2a97eb9639'; -- LLR30
update aip_reference_zones set altitude_text = 'GND – 11,000 ft AMSL' where id = '1d6b857b-0650-4858-b03b-51c23c68c729'; -- LLR801
update aip_reference_zones set altitude_text = 'GND – 11,000 ft AMSL' where id = '23dadc7f-0504-46a4-8553-2d2bcc94996e'; -- LLR802
update aip_reference_zones set altitude_text = 'GND – 11,000 ft AMSL' where id = '9aba8cf2-4b8e-40c7-93b9-8cee7f06d66d'; -- LLR803
update aip_reference_zones set altitude_text = 'GND – 11,000 ft AMSL' where id = '917056aa-e149-4cc3-a45a-85a09a25d8a8'; -- LLR83
update aip_reference_zones set altitude_text = 'GND – 11,000 ft AMSL' where id = '89f390ab-493a-46f4-b80c-de07dad29975'; -- LLR90
update aip_reference_zones set altitude_text = 'בכל גובה (GND – UNL)' where id = '54d23166-807d-4023-9523-580e55efe27d'; -- LLR900
