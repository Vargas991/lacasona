#define MyAppName "La Casona POS"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "EddersonVargas"
#define MyAppURL "https://github.com/Vargas991/lacasona"
#define MyAppExeName "install.ps1"
#define MyAppDirName "LaCasonaPOS"
#define MySourceRoot ".."

[Setup]
AppId={{C1A9A4F1-0A1F-4B69-8D91-7F0B2D6A1151}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
DefaultDirName={localappdata}\{#MyAppDirName}
OutputDir=output
OutputBaseFilename=LaCasonaPOS-Setup-v{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupLogging=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: unchecked
Name: "runinstall"; Description: "Ejecutar instalacion inicial al finalizar"; GroupDescription: "Configuracion:"; Flags: checkedonce

[Files]
Source: "{#MySourceRoot}\install.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\start-prod.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\stop-prod.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\update.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceRoot}\apps\backend\package.json"; DestDir: "{app}\apps\backend"; Flags: ignoreversion
Source: "{#MySourceRoot}\apps\backend\dist\*"; DestDir: "{app}\apps\backend\dist"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.d.ts,*.js.map,*.tsbuildinfo"
Source: "{#MySourceRoot}\apps\backend\prisma\schema.prisma"; DestDir: "{app}\apps\backend\prisma"; Flags: ignoreversion
Source: "{#MySourceRoot}\apps\backend\prisma\seed.js"; DestDir: "{app}\apps\backend\prisma"; Flags: ignoreversion
Source: "{#MySourceRoot}\apps\backend\prisma\migrations\*"; DestDir: "{app}\apps\backend\prisma\migrations"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceRoot}\apps\frontend\dist\*"; DestDir: "{app}\apps\frontend\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceRoot}\apps\frontend\scripts\preview-static.mjs"; DestDir: "{app}\apps\frontend\scripts"; Flags: ignoreversion

[Dirs]
Name: "{localappdata}\{#MyAppDirName}"
Name: "{localappdata}\{#MyAppDirName}\.runtime"
Name: "{localappdata}\{#MyAppDirName}\.runtime\logs"
Name: "{localappdata}\{#MyAppDirName}\.runtime\pids"
Name: "{localappdata}\{#MyAppDirName}\backups"

[Icons]
Name: "{group}\{#MyAppName} - Iniciar"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\start-prod.ps1"" -NoBuild"; WorkingDir: "{app}"
Name: "{group}\{#MyAppName} - Detener"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\stop-prod.ps1"""; WorkingDir: "{app}"
Name: "{group}\{#MyAppName} - Carpeta"; Filename: "{app}"
Name: "{group}\{#MyAppName} - Backups"; Filename: "{localappdata}\{#MyAppDirName}\backups"
Name: "{autodesktop}\{#MyAppName}"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\start-prod.ps1"" -NoBuild"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -NoExit -File ""{app}\install.ps1"" {code:GetInstallScriptParams}"; WorkingDir: "{app}"; Description: "Ejecutar instalacion inicial de {#MyAppName}"; Flags: postinstall shellexec skipifsilent; Tasks: runinstall

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\stop-prod.ps1"" -PurgeRuntime"; WorkingDir: "{app}"; Flags: runhidden skipifdoesntexist; RunOnceId: "StopLaCasonaPOS"

[Code]
var
  DatabasePage: TInputQueryWizardPage;
  NetworkPage: TInputQueryWizardPage;
  PrinterPage: TInputQueryWizardPage;
  PrinterType: String;

procedure InitializeWizard;
begin
  DatabasePage := CreateInputQueryPage(
    wpSelectTasks,
    'Base de datos y seguridad',
    'Define la conexion principal del sistema',
    'Estos valores se pasaran a install.ps1 para dejar el sistema listo.'
  );

  DatabasePage.Add('DATABASE_URL', False);
  DatabasePage.Add('JWT_SECRET (dejar vacio para autogenerar)', False);

  DatabasePage.Values[0] := 'postgresql://postgres:clave@localhost:5432/lacasona';
  DatabasePage.Values[1] := '';

  NetworkPage := CreateInputQueryPage(
    DatabasePage.ID,
    'Red y puertos',
    'Configura el acceso local al sistema',
    'Indica los puertos de backend/frontend y la URL de API que usara el frontend.'
  );

  NetworkPage.Add('Puerto backend', False);
  NetworkPage.Add('Puerto frontend', False);
  NetworkPage.Add('URL API (VITE_API_URL)', False);

  NetworkPage.Values[0] := '3000';
  NetworkPage.Values[1] := '4173';
  NetworkPage.Values[2] := 'http://192.168.1.3:3000';

  PrinterPage := CreateInputQueryPage(
    NetworkPage.ID,
    'Impresora',
    'Configura la impresora de tickets',
    'Selecciona el tipo de impresora y, si es de red, indica IP y puerto.'
  );
  PrinterPage.Add('Tipo de impresora (network/usb)', False);
  PrinterPage.Add('IP de la impresora (solo network)', False);
  PrinterPage.Add('Puerto de la impresora (solo network)', False);
  PrinterPage.Values[0] := 'network';
  PrinterPage.Values[1] := '192.168.0.100';
  PrinterPage.Values[2] := '9100';
end;

function GetInstallScriptParams(Param: string): string;
begin
  Result :=
    '-DatabaseUrl "' + DatabasePage.Values[0] + '" ' +
    '-BackendPort ' + NetworkPage.Values[0] + ' ' +
    '-FrontendPort ' + NetworkPage.Values[1] + ' ' +
    '-ApiBaseUrl "' + NetworkPage.Values[2] + '" ' +
    '-BackupDir "' + ExpandConstant('{localappdata}\{#MyAppDirName}\backups') + '" ' +
    '-PrinterType "' + PrinterPage.Values[0] + '"';

  if LowerCase(Trim(PrinterPage.Values[0])) = 'network' then begin
    Result := Result + ' -PrinterIp "' + PrinterPage.Values[1] + '" -PrinterPort ' + PrinterPage.Values[2];
  end;

  if Trim(DatabasePage.Values[1]) <> '' then begin
    Result := Result + ' -JwtSecret "' + DatabasePage.Values[1] + '"';
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = DatabasePage.ID then begin
    if Trim(DatabasePage.Values[0]) = '' then begin
      MsgBox('DATABASE_URL es obligatorio.', mbError, MB_OK);
      Result := False;
      exit;
    end;
  end;

  if CurPageID = NetworkPage.ID then begin
    if Trim(NetworkPage.Values[0]) = '' then begin
      MsgBox('Debes indicar el puerto backend.', mbError, MB_OK);
      Result := False;
      exit;
    end;

    if Trim(NetworkPage.Values[1]) = '' then begin
      MsgBox('Debes indicar el puerto frontend.', mbError, MB_OK);
      Result := False;
      exit;
    end;

    if Trim(NetworkPage.Values[2]) = '' then begin
      MsgBox('Debes indicar la URL API.', mbError, MB_OK);
      Result := False;
      exit;
    end;
  end;

  if CurPageID = PrinterPage.ID then begin
    if Trim(PrinterPage.Values[0]) = '' then begin
      MsgBox('Debes indicar el tipo de impresora (network o usb).', mbError, MB_OK);
      Result := False;
      exit;
    end;
    if LowerCase(Trim(PrinterPage.Values[0])) = 'network' then begin
      if Trim(PrinterPage.Values[1]) = '' then begin
        MsgBox('Debes indicar la IP de la impresora de red.', mbError, MB_OK);
        Result := False;
        exit;
      end;
      if Trim(PrinterPage.Values[2]) = '' then begin
        MsgBox('Debes indicar el puerto de la impresora de red.', mbError, MB_OK);
        Result := False;
        exit;
      end;
    end;
  end;
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  MsgBox(
    'Este instalador copiara los archivos de La Casona POS y luego podra ejecutar install.ps1 para completar la configuracion.' + #13#10 + #13#10 +
    'Requisitos previos:' + #13#10 +
    '- Node.js instalado' + #13#10 +
    '- PostgreSQL accesible' + #13#10 +
    '- Permisos de administrador',
    mbInformation,
    MB_OK
  );
end;
