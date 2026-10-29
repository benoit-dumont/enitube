<?php
declare(strict_types=1);

// Secret de 32 caractères exactement, fourni via Docker secret
$cfg['blowfish_secret'] = trim((string) file_get_contents('/run/secrets/pma_blowfish'));

$i = 1;
$cfg['Servers'][$i]['auth_type']       = 'cookie';
$cfg['Servers'][$i]['host']            = 'mysql';
$cfg['Servers'][$i]['compress']        = false;
$cfg['Servers'][$i]['AllowNoPassword'] = false;
$cfg['Servers'][$i]['AllowRoot']       = true;

$cfg['AllowArbitraryServer'] = false;
$cfg['LoginCookieValidity']  = 1800;
$cfg['LoginCookieStore']     = 0;
$cfg['LoginCookieDeleteAll'] = true;
$cfg['TempDir']              = '/tmp/pma';
$cfg['VersionCheck']         = false;
$cfg['SendErrorReports']     = 'never';
$cfg['ShowPhpInfo']          = false;
$cfg['ShowServerInfo']       = false;
