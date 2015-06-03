<?php

$GMScripts = array('flickr.importer.user.js'=>1.16,
           'flickr.album.importer.user.js'=>1.5,
				   'flickr.1photo.user.js'=>1.19,
           'flickr.messenger.user.js'=>1.3);

$x = explode('/',substr($_SERVER['PATH_INFO'],1),3);

#
# version /gm.php/version/script
#

if ( $x[0]=='version' && $GMScripts[$x[1].'.user.js'])
{
	header('Connection: close');
	die($GMScripts[$x[1].'.user.js']);
}

#
# download /gm.php/download/1.X/script.user.js
#

elseif ( $x[0]=='download' && $GMScripts[$x[2]])
{
	$common = file_get_contents('common.js');
	$script = file_get_contents($x[2]);
  
	header('Content-Type: text/javascript');
	header('Connection: close');
	echo str_replace('<!--common.js-->',$common,$script);
	die();
}

header("HTTP/1.0 404 Not Found");
die("404/GM script not found.");

