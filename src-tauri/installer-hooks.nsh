; Tauri includes this file before product defines. Use the stable MuseMark
; shortcut names, preserving arguments/AppUserModelID and shortcut opt-out.
!macro MuseMarkRepairShortcut LINK
  ${If} ${FileExists} "${LINK}"
    !insertmacro IsShortcutTarget "${LINK}" "$INSTDIR\musemark.exe"
    Pop $R0
    ${If} $R0 = 1
      !insertmacro ComHlpr_CreateInProcInstance ${CLSID_ShellLink} ${IID_IShellLink} r0 ""
      ${If} $0 P<> 0
        ${IUnknown::QueryInterface} $0 '("${IID_IPersistFile}",.r1)'
        ${If} $1 P<> 0
          ${IPersistFile::Load} $1 '("${LINK}", ${STGM_READWRITE})'
          ${IShellLink::SetIconLocation} $0 '(w "$INSTDIR\musemark.exe", i 0)'
          ${IPersistFile::Save} $1 '("${LINK}",1)'
          ${IUnknown::Release} $1 ""
        ${EndIf}
        ${IUnknown::Release} $0 ""
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

Function MuseMarkRepairIcons
  !insertmacro MuseMarkRepairShortcut "$DESKTOP\MuseMark.lnk"
  !insertmacro MuseMarkRepairShortcut "$SMPROGRAMS\MuseMark.lnk"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
FunctionEnd

!macro NSIS_HOOK_POSTINSTALL
  Call MuseMarkRepairIcons
!macroend

; The finish page may create the desktop link after POSTINSTALL.
Function .onGUIEnd
  Call MuseMarkRepairIcons
FunctionEnd
