$taskPrefix = "GOMITA Backup"
$workDir = "E:\Product\7. Go CNC\PM\ok\gomita_quan_ly_cong_ty"
$runBackupBat = Join-Path $workDir "scripts\run-backup.bat"
$runCatchupBat = Join-Path $workDir "scripts\run-catchup-backup.bat"

function Register-GomitaTask {
  param(
    [string]$TaskName,
    [string]$TaskCommand,
    [ValidateSet("DailyMidnight", "DailyNoon", "AtLogon")]
    [string]$Mode
  )

  $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$TaskCommand`"" -WorkingDirectory $workDir
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew

  switch ($Mode) {
    "DailyMidnight" {
      $trigger = New-ScheduledTaskTrigger -Daily -At "12:00AM"
    }
    "DailyNoon" {
      $trigger = New-ScheduledTaskTrigger -Daily -At "12:00PM"
    }
    "AtLogon" {
      $trigger = New-ScheduledTaskTrigger -AtLogOn
    }
  }

  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
}

Register-GomitaTask -TaskName "$taskPrefix 00h" -TaskCommand $runBackupBat -Mode "DailyMidnight"
Register-GomitaTask -TaskName "$taskPrefix 12h" -TaskCommand $runBackupBat -Mode "DailyNoon"
Register-GomitaTask -TaskName "$taskPrefix Catchup AtLogon" -TaskCommand $runCatchupBat -Mode "AtLogon"

Write-Output "Da cai lich backup GOMITA: 00h, 12h va backup bu khi dang nhap may."
