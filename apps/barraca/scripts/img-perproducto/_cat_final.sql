UPDATE barraca_categorias c SET imagen=m.url FROM (VALUES
('Fierros Construccion','https://http2.mlstatic.com/D_Q_NP_2X_758110-MLC52916162783_122022-E.webp'),
('Herramientas y Maq','https://http2.mlstatic.com/D_Q_NP_2X_955652-MLC93298427518_092025-E.webp'),
('Fijaciones','https://http2.mlstatic.com/D_Q_NP_2X_790297-CBT109812139562_042026-E.webp'),
('Cerraduras','https://http2.mlstatic.com/D_Q_NP_2X_863527-MLA100033539615_122025-E.webp'),
('Quincalleria','https://http2.mlstatic.com/D_Q_NP_2X_619563-MLA107292817117_022026-E.webp'),
('Adhesivos y Sellantes','https://http2.mlstatic.com/D_Q_NP_2X_752334-MLA99938470451_112025-E.webp'),
('Aditivos e Impermeabilizantes','https://http2.mlstatic.com/D_Q_NP_2X_803260-MLA99927334253_112025-E.webp'),
('Aislacion','https://http2.mlstatic.com/D_Q_NP_2X_842612-MLC111645760085_052026-E.webp'),
('Tabiqueria','https://http2.mlstatic.com/D_Q_NP_2X_905417-MLC51426017101_092022-E.webp'),
('Techumbre','https://http2.mlstatic.com/D_Q_NP_2X_636044-MLC96658187474_112025-E.webp'),
('Pinturas','https://http2.mlstatic.com/D_Q_NP_2X_781947-MLA109745490458_042026-E.webp'),
('Electricidad e Iluminacion','https://http2.mlstatic.com/D_Q_NP_2X_888184-MLA102163995941_122025-E.webp'),
('Jardin','https://http2.mlstatic.com/D_Q_NP_2X_932536-MLA108601437281_032026-E.webp'),
('Seguridad Industrial','https://http2.mlstatic.com/D_Q_NP_2X_847441-MLC109909910178_042026-E.webp'),
('Perfiles y Planchas','https://http2.mlstatic.com/D_Q_NP_2X_688194-MLC107750028590_032026-E.webp')
) AS m(nombre,url) WHERE c.nombre=m.nombre;
