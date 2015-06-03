// Flickr importer v1.16
// http://www.ipernity.com/apps/

// ==UserScript==
// @name          Ipernity: Flickr importer
// @version       1.16
// @description   Import *all* your photos to ipernity (starting from the first uploaded)
// @include       http://www.flickr.com/photos/*
// @include       http://flickr.com/photos/*
// @include       https://www.flickr.com/photos/*
// @include       https://flickr.com/photos/*
// @exclude       http://www.flickr.com/photos/organize*
// @exclude       http://flickr.com/photos/organize*
// @exclude       https://www.flickr.com/photos/organize*
// @exclude       https://flickr.com/photos/organize*
// @exclude       http://www.flickr.com/photos/*/sets/*
// @exclude       http://flickr.com/photos/*/sets/*
// @exclude       https://www.flickr.com/photos/*/sets/*
// @exclude       https://flickr.com/photos/*/sets/*
// @grant         GM_xmlhttpRequest
// ==/UserScript==

// created by Dan Boney
//
// This is a Greasemonkey user script.
//
// To install, you need FireFox  http://www.mozilla.org/firefox and the
// firefox extension called Greasemonkey: http://www.greasespot.net/
// Install the Greasemonkey extension then restart Firefox and revisit this script.
// There should now be a button at the top of the screen saying "Install User Script".
// Click it and accept the default configuration and install.
//
// To uninstall, go to Tools/Manage User Scripts,
// select "flickr.importer", and click Uninstall.
//
//

/*
  ChangeLog
  =========
  v1.5  05-Aug-2008 : added debug traces
  v1.6  08-Jul-2009 : bug fixes
  v1.7  18-Nov-2009 : bug fixes
  v1.9  21-Jun-2011 : compatibility to new Flickr photo page
  v1.11  28-May-2013 : HTTPS support
  v1.12  19-Jun-2013 : duplicate support
  v1.13  20-June-2013 : bugfix
  v1.14  21-June-2013 : safety support
  v1.15  28-July-2014 : add grant for GM_xmlhttpRequest
  v1.16  17-May-2015 : bugfix new layout
*/

(function() {

<!--common.js-->

  var about = { 'name': 'Flickr importer',
                'script': 'flickr.importer',
                'version': '1.16' };

  console.info(about.name+": checking if script is allowed");

  if(w.F && w.F.config) {

    var conf = w.F.config;
    var global_auth_hash=conf.flickrAPI.auth_hash;
    var global_auth_token=conf.flickrAPI.auth_token;
    var photos_url=conf.flickr.user.photos_url;
    var global_nsid=conf.flickr.user.nsid;
    var hostname=w.document.location.href.split('/')[2];

    var api_key = conf.flickrAPI.api_key;
    var auth_hash =conf.flickrAPI.auth_hash;
    var auth_token= conf.flickrAPI.auth_token;
    var secret    = conf.flickrAPI.secret;

    var photo_id = conf.flickr.photo ? conf.flickr.photo.id : null;

    var isOwner = (photo_id && w.document.location.href.indexOf(photos_url)>0);

  } 
  else if(w.YUI_config && w.YUI_config.flickr && w.YUI_config.flickr.api) {
    // Hermes interface

    api_key = w.YUI_config.flickr.api.site_key;

    if (w.auth && w.auth.user) {
      var global_nsid = user_nsid = w.auth.user.nsid;
    }
    else {
      console.warn("Cannot get nsid");
      return;
    }
  }
  else {
    
    var global_nsid=w.global_nsid;
    var global_auth_hash=w.global_auth_hash;
    var global_auth_token=w.global_auth_token;
    var photos_url=w.photos_url;
    var hostname=w.document.location.href.split('/')[2];

    var api_key = w.global_magisterLudi;
    var auth_hash = w.global_auth_hash;
    var auth_token= w.global_auth_token;
    var secret    = w.global_flickr_secret;
  }

//  console.log("photo_id="+photo_id+", url="+photos_url+", api_key="+api_key+" isOwner="+isOwner);
  console.log("api_key="+api_key+" isOwner="+isOwner);
  
  var placeHolder = document.getElementsByClassName('photolist-container')[0];

  // check you're on the right page
  if (!placeHolder) return;

  console.info(about.name+": script loading...");

  // check update & session

  check_update();
  check_session();

  function request(method,params,callback) {
    commonRequest(method,params,callback,'importer');
  }

  function request_callback(result,params,callback) {
    if( result.status != 200 ) alert(about.name+': Call to Flickr API has failed.');

    // TODO checker le code d'erreur potentiel renvoyé par Flickr : clé expirée, over call quota ?
    var txt = result.responseText;
    var parser = new DOMParser();
    var xml = parser.parseFromString(txt, "application/xml");

    if ( ! xml.childNodes ) {alert(about.name+": Invalid response: "+result.responseText); return window[callback](0); }

    return window[callback](1,xml,txt,params);
  }


  // (c) flickr

  var escape_utf8=function(s)
  {
	 if(s===0) { return "0"; }
	 if(s===""||s===null) { return ""; }

    s=s.toString();

	 if(s.match(/^[\s\n\r\t]+$/)) return "";

    var r="";
    for(var i=0;i<s.length;i++)
    {
      var c=s.charCodeAt(i);
      var bs=new Array();
      if(c>65536)
	{
	  bs[0]=240|((c&1835008)>>>18);bs[1]=128|((c&258048)>>>12);bs[2]=128|((c&4032)>>>6);bs[3]=128|(c&63);
	}
      else
	{
	  if(c>2048)
	    {
	      bs[0]=224|((c&61440)>>>12);bs[1]=128|((c&4032)>>>6);bs[2]=128|(c&63);
	    }
	  else
	    {
	      if(c>128)
		{
		  bs[0]=192|((c&1984)>>>6);bs[1]=128|(c&63);
		}
	      else
		{
		  bs[0]=c;
		}

	    }

	}
      if(bs.length>1)
	{
	  for(var j=0;j<bs.length;j++)
	    {
	      var b=bs[j];
	      var hex=nibble_to_hex((b&240)>>>4)+nibble_to_hex(b&15);r+="%"+hex;
	    }

	}
      else
	{
	  r+=encodeURIComponent(String.fromCharCode(bs[0]));
	}

    }
    return r;
  };

  var nibble_to_hex=function(s)
  {
    var h="0123456789ABCDEF";
    return h.charAt(s);
  };

  // (c) flickr 'md5.js'

  var md5_hex_chr="0123456789abcdef";function md5_rhex(_1){str="";for(j=0;j<=3;j++){str+=md5_hex_chr.charAt((_1>>(j*8+4))&15)+md5_hex_chr.charAt((_1>>(j*8))&15);}return str;}function md5_str2blks_MD5(_2){nblk=((_2.length+8)>>6)+1;blks=new Array(nblk*16);for(i=0;i<nblk*16;i++){blks[i]=0;}for(i=0;i<_2.length;i++){blks[i>>2]|=_2.charCodeAt(i)<<((i%4)*8);}blks[i>>2]|=128<<((i%4)*8);blks[nblk*16-2]=_2.length*8;return blks;}function md5_add(x,y){var _5=(x&65535)+(y&65535);var _6=(x>>16)+(y>>16)+(_5>>16);return (_6<<16)|(_5&65535);}function md5_rol(_7,_8){return (_7<<_8)|(_7>>>(32-_8));}function md5_cmn(q,a,b,x,s,t){return md5_add(md5_rol(md5_add(md5_add(a,q),md5_add(x,t)),s),b);}function md5_ff(a,b,c,d,x,s,t){return md5_cmn((b&c)|((~b)&d),a,b,x,s,t);}function md5_gg(a,b,c,d,x,s,t){return md5_cmn((b&d)|(c&(~d)),a,b,x,s,t);}function md5_hh(a,b,c,d,x,s,t){return md5_cmn(b^c^d,a,b,x,s,t);}function md5_ii(a,b,c,d,x,s,t){return md5_cmn(c^(b|(~d)),a,b,x,s,t);}function md5_calcMD5(str){x=md5_str2blks_MD5(str);a=1732584193;b=-271733879;c=-1732584194;d=271733878;for(i=0;i<x.length;i+=16){olda=a;oldb=b;oldc=c;oldd=d;a=md5_ff(a,b,c,d,x[i+0],7,-680876936);d=md5_ff(d,a,b,c,x[i+1],12,-389564586);c=md5_ff(c,d,a,b,x[i+2],17,606105819);b=md5_ff(b,c,d,a,x[i+3],22,-1044525330);a=md5_ff(a,b,c,d,x[i+4],7,-176418897);d=md5_ff(d,a,b,c,x[i+5],12,1200080426);c=md5_ff(c,d,a,b,x[i+6],17,-1473231341);b=md5_ff(b,c,d,a,x[i+7],22,-45705983);a=md5_ff(a,b,c,d,x[i+8],7,1770035416);d=md5_ff(d,a,b,c,x[i+9],12,-1958414417);c=md5_ff(c,d,a,b,x[i+10],17,-42063);b=md5_ff(b,c,d,a,x[i+11],22,-1990404162);a=md5_ff(a,b,c,d,x[i+12],7,1804603682);d=md5_ff(d,a,b,c,x[i+13],12,-40341101);c=md5_ff(c,d,a,b,x[i+14],17,-1502002290);b=md5_ff(b,c,d,a,x[i+15],22,1236535329);a=md5_gg(a,b,c,d,x[i+1],5,-165796510);d=md5_gg(d,a,b,c,x[i+6],9,-1069501632);c=md5_gg(c,d,a,b,x[i+11],14,643717713);b=md5_gg(b,c,d,a,x[i+0],20,-373897302);a=md5_gg(a,b,c,d,x[i+5],5,-701558691);d=md5_gg(d,a,b,c,x[i+10],9,38016083);c=md5_gg(c,d,a,b,x[i+15],14,-660478335);b=md5_gg(b,c,d,a,x[i+4],20,-405537848);a=md5_gg(a,b,c,d,x[i+9],5,568446438);d=md5_gg(d,a,b,c,x[i+14],9,-1019803690);c=md5_gg(c,d,a,b,x[i+3],14,-187363961);b=md5_gg(b,c,d,a,x[i+8],20,1163531501);a=md5_gg(a,b,c,d,x[i+13],5,-1444681467);d=md5_gg(d,a,b,c,x[i+2],9,-51403784);c=md5_gg(c,d,a,b,x[i+7],14,1735328473);b=md5_gg(b,c,d,a,x[i+12],20,-1926607734);a=md5_hh(a,b,c,d,x[i+5],4,-378558);d=md5_hh(d,a,b,c,x[i+8],11,-2022574463);c=md5_hh(c,d,a,b,x[i+11],16,1839030562);b=md5_hh(b,c,d,a,x[i+14],23,-35309556);a=md5_hh(a,b,c,d,x[i+1],4,-1530992060);d=md5_hh(d,a,b,c,x[i+4],11,1272893353);c=md5_hh(c,d,a,b,x[i+7],16,-155497632);b=md5_hh(b,c,d,a,x[i+10],23,-1094730640);a=md5_hh(a,b,c,d,x[i+13],4,681279174);d=md5_hh(d,a,b,c,x[i+0],11,-358537222);c=md5_hh(c,d,a,b,x[i+3],16,-722521979);b=md5_hh(b,c,d,a,x[i+6],23,76029189);a=md5_hh(a,b,c,d,x[i+9],4,-640364487);d=md5_hh(d,a,b,c,x[i+12],11,-421815835);c=md5_hh(c,d,a,b,x[i+15],16,530742520);b=md5_hh(b,c,d,a,x[i+2],23,-995338651);a=md5_ii(a,b,c,d,x[i+0],6,-198630844);d=md5_ii(d,a,b,c,x[i+7],10,1126891415);c=md5_ii(c,d,a,b,x[i+14],15,-1416354905);b=md5_ii(b,c,d,a,x[i+5],21,-57434055);a=md5_ii(a,b,c,d,x[i+12],6,1700485571);d=md5_ii(d,a,b,c,x[i+3],10,-1894986606);c=md5_ii(c,d,a,b,x[i+10],15,-1051523);b=md5_ii(b,c,d,a,x[i+1],21,-2054922799);a=md5_ii(a,b,c,d,x[i+8],6,1873313359);d=md5_ii(d,a,b,c,x[i+15],10,-30611744);c=md5_ii(c,d,a,b,x[i+6],15,-1560198380);b=md5_ii(b,c,d,a,x[i+13],21,1309151649);a=md5_ii(a,b,c,d,x[i+4],6,-145523070);d=md5_ii(d,a,b,c,x[i+11],10,-1120210379);c=md5_ii(c,d,a,b,x[i+2],15,718787259);b=md5_ii(b,c,d,a,x[i+9],21,-343485551);a=md5_add(a,olda);b=md5_add(b,oldb);c=md5_add(c,oldc);d=md5_add(d,oldd);}return md5_rhex(a)+md5_rhex(b)+md5_rhex(c)+md5_rhex(d);}

  function page_name(p) { return "chunk "+p+" (photo "+((p-1)*per_page+1)+" - "+(p*per_page)+")"; }
  function fix_perm(p)  { p=_pi(p); var f = {3:15, 2:7, 1:3 }; return (f[p])? f[p]:0;  }
  function fix_lic(p)   { p = _pi(p); var f = {4:1, 6:5, 3:7, 2:3, 1:11, 5:9 }; return (f[p])? f[p]:0;  }

  //
  // Insert link
  //

  // per_page

  var page=0;
  var pages=0;
  var per_page = (debug_mode)? 9 : 90;
  var divs = [];

  var is_importing = false;
  var photo_ids = [];
  var photos = [];
  var done = [];

  if (placeHolder)
  {
	 // launcher

	 var launcher  = document.createElement("div");
	 launcher.style.border="solid 1px #888";
	 launcher.style.backgroundColor="#fefefe";
	 launcher.style.padding="5px";
	 launcher.style.margin="5px";
	 launcher.style.textAlign="center";
         launcher.style.display="none";   // hide container for the moment, function checkIfOwner will display it if i'm the owner
 
	 var link = document.createElement('a');
	 link.href="#";
	 link.addEventListener('click',function(e) { e.stopPropagation();  e.preventDefault(); get_chunks(); }, true);
	 link.innerHTML='CLICK HERE TO START '+about.name+' '+about.version;

	 launcher.appendChild(link);

	 // controller

	 var controller  = document.createElement("div");
	 controller.style.display="none";
	 controller.style.border="solid 1px #888";
	 controller.style.backgroundColor="#fefefe";
	 controller.style.padding="5px";
	 controller.style.margin="5px";
	 controller.style.textAlign="center";

	 var form = document.createElement("form");

	 form.addEventListener('submit', function(e) { e.stopPropagation();  e.preventDefault();  }, true);

	 var select = document.createElement("select");
	 var opt = document.createElement('option');
	 opt.value = 1;
	 opt.appendChild(document.createTextNode("loading chunk list..."));
	 select.appendChild(opt);

	 select.addEventListener('change',function(e) { get_preview(); },true);

	 var submit = document.createElement("input");
	 submit.type="submit";
	 submit.className="Button";
	 submit.value="Import to ipernity";
	 submit.style.visibility="hidden";

	 submit.addEventListener('click', function(e) { e.stopPropagation(); get_photo_page(); }, true);

	 var ver = document.createElement("a");
	 ver.style.fontSize="11px";
	 ver.href="http://"+iol_host+"/apps/gm";
	 ver.innerHTML = "("+about.version+")";

	 form.appendChild(select);
	 form.appendChild(submit);
	 form.appendChild(ver);
	 controller.appendChild(form);

	 preview_tab = document.createElement("table");
	 preview_tab.style.display="none";
	 var tbody = document.createElement("tbody");
	 preview_tab.appendChild(tbody);

	 var tr  = document.createElement("tr");
	 var td1 = document.createElement("td");
	 var td2 = document.createElement("td");

	 preview_img = document.createElement("img");
	 preview_img.style.width="75px";
	 preview_img.style.height="75px";

	 td1.appendChild(preview_img);

	 preview_txt = document.createElement("p");

	 td2.appendChild(preview_txt);

	 tr.appendChild(td1);
	 tr.appendChild(td2);
	 tbody.appendChild(tr);

	 controller.appendChild(preview_tab);

	 var previews = [];
	 var preview = document.createElement("div");
	 preview.style.border="solid 1px #eee";
	 preview.style.padding="5px";
	 preview.style.margin="5px";
	 preview.style.display="none";

	 var cf = document.createElement("div");
	 cf.style.clear="both";
    
        placeHolder.parentNode.insertBefore(cf, placeHolder);
        placeHolder.parentNode.insertBefore(launcher, placeHolder);
        placeHolder.parentNode.insertBefore(controller, placeHolder);
        placeHolder.parentNode.insertBefore(preview, placeHolder);
    
	 divs['launcher'] = launcher;
	 divs['controller'] = controller;
	 divs['preview'] = preview;

  }

	//
	// get_chunks : load your photostream
	//

	function get_chunks() {

	       console.info("Loading your photostream from Flickr...");
	       console.log("nsid="+global_nsid);
	       console.log("per_page="+per_page);
console.log("global_nsid="+global_nsid);
	       msg("<em>Loading your photostream...</em>");

	       request('flickr.photos.search',{user_id: global_nsid, page:0, per_page: per_page, media:"photos"},'show_chunks');
	}

	//
	// show_chunks : get_chunks callback
	//

	var show_chunks = function(ok,xml,txt,params)
	{
	       if ( ok )
	       {
		      msg("<em>Good...</em>");

		      divs['controller'].style.display="block";
		      divs['preview'].style.display="block";

		      console.info("Photostream loaded.");
		      var r = xml.getElementsByTagName('photos')[0];

		      page  = _pi(r.getAttribute('page'));
		      pages = _pi(r.getAttribute('pages'));

		      console.log("page="+page+", pages="+pages);

		      select.options.length=0;

		      for(var i=1;i<=pages;i++)
		      {
			     var opt = document.createElement('option');
			     opt.value = i;
			     opt.appendChild(document.createTextNode(page_name(i)));
			     select.appendChild(opt);
		      }

		      submit.style.visibility="visible";

		      get_preview();
	       }
	       else
	       {
		      console.warn("Could not load photos");

		      msg("<em>Failed to load your photostream previews. Sorry...</em>");

		      select.options.length=0;
	       }
	};

	window['show_chunks'] = show_chunks;

	//
	// get_preview
	//

	function get_preview() {

	       msg("<em>Loading previews...</em>");

	       console.info("Loading previews...");

	       is_importing = true;

	       page = select.selectedIndex+1;

	       var sort = 'date-posted-asc';

	       preview.style.display="block";
	       preview.innerHTML="<h3>loading previews...</h3>";
	       previews = [];

	       console.log("flickr.photos.search for page="+page);

	       request('flickr.photos.search',{user_id: global_nsid, page: page, per_page: per_page, sort:sort, extras:"icon_server,original_format", media:"photos"},'show_preview');
	}

	//
	// show_preview
	//

	var show_preview = function(ok,xml,txt,params) {

	       if ( ok )
	       {
		      console.info("Getting photo list details for page="+page);

		      preview.innerHTML="";

		      var els = xml.getElementsByTagName('photo');

		      for (var i=0; i<els.length; i++){

			     var p = els[i];

			     var photo = { id        : p.getAttribute('id'),
					   secret    : p.getAttribute('secret'),
					   server    : p.getAttribute('server'),
					   farm      : p.getAttribute('farm'),
					   title     : p.getAttribute('title'),
					   originalsecret : p.getAttribute('originalsecret'),
					   originalformat : p.getAttribute('originalformat')
					 };

			     console.log("added photo_id="+photo.id);
			     console.log(photo);

			     var img = document.createElement("img");
			     img.style.padding="3px";
			     img.style.width=img.style.height="75px";
			     img.src = "http://farm"+photo.farm+".static.flickr.com/"+photo.server+"/"+photo.id+"_"+photo.secret+"_s.jpg";

			     previews[photo.id] = img;

			     preview.appendChild(img);

		      }
		      is_importing = false;
	       }
	       else
	       {
		      console.warn("Could not get photo list details for page="+page);
		      preview.innerHTML="<h3>Sorry, could not load the photo list for page "+page+"</h3>";
		      is_importing=false;
	       }
	};

	window['show_preview'] = show_preview;


	// Import

	var get_photo_page = function() {

	       if ( is_importing ) alert(about.name+": import in process. Please wait.");

	       is_importing = true;

	       page = select.selectedIndex+1;

	       if ( done[page] )
	       {
		      is_importing = false;
		      alert(about.name+': this chunk of photos has always been imported');
		      return;
	       }

	       var ex = "license,date_upload,date_taken,owner_name,icon_server,original_format,last_update,geo";

	       photo_ids = [];

	       var sort = 'date-posted-asc';

	       request('flickr.photos.search',{user_id: global_nsid, extras : ex, page: page, per_page: per_page, sort:sort, media:"photos"},'parse_photo_page');

	};

	//<photos page="1" pages="337" perpage="5" total="1685">
	//<photo id="571067849" owner="93408634@N00" secret="bdb30c2218" server="1192" farm="2" title="DSC03782" ispublic="1" isfriend="0" isfamily="0" license="0" dateupload="1182279675" datetaken="2007-06-15 13:14:59" datetakengranularity="0" ownername="christopheruelle" iconserver="69" iconfarm="1" originalsecret="827dc2b214" originalformat="jpg" lastupdate="1182863705" latitude="0" longitude="0" accuracy="0"/>

	var parse_photo_page = function(ok,xml,txt,params) {

	       if ( ! ok ) return;

	       var r = xml.getElementsByTagName('photos')[0];

	       var total = _pi(r.getAttribute('total'));

	       msg("Importing chunk "+page+"/"+pages+" ("+total+" photos)");

	       var els = xml.getElementsByTagName('photo');

	       var t = '';

	       for (var i=0; i<els.length; i++){

		      var p = els[i];

		      var photo = { id        : p.getAttribute('id'),
				    secret    : p.getAttribute('secret'),
				    server    : p.getAttribute('server'),
				    farm      : p.getAttribute('farm'),
				    title     : p.getAttribute('title'),
				    ispublic  : _pi(p.getAttribute('ispublic')),
				    isfriend  : _pi(p.getAttribute('isfriend')),
				    isfamily  : _pi(p.getAttribute('isfamily')),
				    license   : _pi(p.getAttribute('license')),
				    dateupload: _pi(p.getAttribute('dateupload')),
				    datetaken : p.getAttribute('datetaken'),
				    originalsecret : p.getAttribute('originalsecret'),
				    originalformat : p.getAttribute('originalformat'),
				    latitude  : _pf(p.getAttribute('latitude')),
				    longitude : _pf(p.getAttribute('longitude')),
				    accuracy  : _pi(p.getAttribute('accuracy'))
				  };

		      photos[photo.id] = photo;

		      photo_ids.push(photo.id);

	       }

	       if (Object.keys(photos).length) {
		      return import_photos();
	       }
	       else {
		      alert(about.name+": Sorry, we could not find photos on this page");
		      is_importing=false;
	       }
	};

	window['parse_photo_page'] = parse_photo_page;

	//
	// import photos
	//

	function import_photos() {

	       // page done ?
	       if ( ! photo_ids.length ) {

		      done[page]=true;
		      select.options[page-1].firstChild.nodeValue = 'chunk '+(page)+' (DONE)';

		      // go to next page

		      if ( page+1 <= pages )  select.selectedIndex++;

		      preview_tab.style.display="none";

		      msg("page "+page+" done.");

		      is_importing = false;

		      if ( page<pages )
		      {
			     preview.innerHTML="<h3>Important: please wait until your photos appear on your ipernity photostream before you start importing the next chunk.</h3>";

			     alert(about.name+": Chunk "+page+" is complete!"+"\n"+"Why don't we preload the next chunk?");

			     setTimeout(function() { get_preview()},3000);
		      }
		      else
		      {
			     alert(about.name+": Thank you, the import is complete."+"\n"+"You can uninstall this GM script as from now.");

		      }
		      return;
	       }

	       preview_tab.style.display="block";

	       // get new id

	       var photo_id = photo_ids.pop();
	       var photo = photos[photo_id];

	       if ( photo )
	       {
		      first_getSizes(photo_id);
	       }
	       else
	       {
		      import_photos();
	       }
	}
	window['import_photos'] = import_photos;

	//
	// first_getSizes
	//

	var first_getSizes = function(photo_id) {
	       console.info("Calling photos.getSizes for photo_id="+photo_id);

	       request('flickr.photos.getSizes',{photo_id:photo_id},'first_getSizes_onApi');
	};

	var first_getSizes_onApi = function(ok,xml,txt,params) {

	       var photo_id = params['photo_id'];

	       if(ok)
	       {
		      var sizes = xml.getElementsByTagName('size');
		      var best = sizes[sizes.length-1];
		      var source = best.getAttribute('source');

		      if(source && photos[photo_id])
		      {
			     photos[photo_id].source = source;

			     second_getInfos(photo_id);
		      }
		      else
		      {
			     console.warn("Could not parse photo.getSize response for photo_id="+photo_id);
			     import_photos();
		      }
	       }
	       else
	       {
		      console.warn("Could not get photo.getSizes for photo_id="+photo_id);
		      import_photos();
	       }
	};
	window['first_getSizes_onApi']=first_getSizes_onApi; // callabck



	function msg(m) {
	       divs['launcher'].innerHTML=m;
	}
        
        
// check if I'm owner, to display import buttons
  function checkIfOwner(iperDiv) {

    if (typeof w.appContext === 'undefined') {
      setTimeout( function() { checkIfOwner(iperDiv);}, 1000);
      return;
    }
    else {
      var myPathAlias = w.appContext.modelImportExport.appContext.modelRegistries["person-models"]["_data"][user_nsid].pathAlias;
      var isOwner = myPathAlias 
          ? (w.document.location.href.indexOf('/photos/'+myPathAlias)>0)
          : (w.document.location.href.indexOf('/photos/'+user_nsid)>0);

      if (isOwner) {
        iperDiv.style.display = 'block';
      }
      else {
        iperDiv.remove();
      }
    }
  }

  if (divs && divs['launcher']) {
    checkIfOwner(divs['launcher']);
  }

 })();
