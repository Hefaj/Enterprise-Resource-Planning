# Polityki MinIO — konto per mikroserwis

Każdy mikroserwis dostaje **własne konto w MinIO** z polityką zawężoną do swoich kubełków
(`erp-{moduł}-artifacts`, `erp-{moduł}-media`). Konta i polityki zakłada usługa `minio-init`
z [`../../docker-compose.yml`](../../docker-compose.yml) przy każdym starcie — idempotentnie.

## Po co, skoro uprawnienia i tak sprawdza endpoint

To są **dwie różne osie separacji** i robią co innego
([`docs/backend/media-storage.md` §2](../../../docs/backend/media-storage.md#2-trzy-osie-separacji)):

| | Odpowiada na pytanie | Trzyma, gdy |
|---|---|---|
| Uprawnienie na endpointcie | czy **ten użytkownik** może zobaczyć **ten plik** | kod działa poprawnie |
| Polityka MinIO | czy **ten serwis** może w ogóle dosięgnąć tych bajtów | kod **się pomylił** |

Bez polityk każdy serwis chodzi na koncie root i pomyłka w kodzie Catalogu — wstrzyknięty nie ten
magazyn, literówka w nazwie kubełka — sięga po skany faktur z DMS-u. Polityka zamienia to
w czytelny `AccessDenied` zamiast wycieku.

Uprawnienia użytkowników **nie mają tu nic do rzeczy**: przeglądarka nigdy nie dostaje poświadczeń
do kubełka, a polityka S3 nie zna pojęcia „użytkownik ERP".

## Dodanie modułu

1. Skopiuj [`catalog.json`](./catalog.json), podmień nazwy kubełków na `erp-{moduł}-*`.
2. Dopisz moduł do pętli `MODULES` w usłudze `minio-init` w `docker-compose.yml`.
3. W `appsettings.Development.json` modułu ustaw `Artifacts:AccessKey` = nazwa modułu,
   `Artifacts:SecretKey` = `{moduł}12345` (dev) i kubełki w `Artifacts:Stores`.

Hasła w tym katalogu i w compose są **wyłącznie deweloperskie**. Na środowiskach wyższych konta
zakłada się poza repo, a sekrety wstrzykuje zmienną środowiskową `Artifacts__SecretKey`.

## Uprawnienia w polityce i skąd się biorą

| Akcja | Kto jej potrzebuje |
|---|---|
| `s3:CreateBucket`, `s3:GetBucketLocation` | `ArtifactBucketInitializer` — moduł zakłada swój kubełek sam, przy starcie |
| `s3:PutLifecycleConfiguration` | ten sam inicjalizator — reguły `erp-staging-cleanup` i `erp-artifact-retention` |
| `s3:ListBucket` | audytor rozjazdu (`media-storage.md` §4d) i `BucketExists` |
| `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` | zapis eksportu, promocja pliku z poczekalni, wydanie zawartości, usunięcie |

Świadomie **nie ma** `s3:DeleteBucket` ani uprawnień administracyjnych: moduł ma zarządzać
zawartością swoich kubełków, a nie ich istnieniem po założeniu.
