// Flickr 1photo importer v1.19
// http://www.ipernity.com/apps/

// ==UserScript==
// @name            Flickr 2 Ipernity (1 photo)
// @version         1.19
// @description     Moves a photo from Yahoo/Flickr to ipernity
// @include         http://www.flickr.com/photos/*
// @include         http://flickr.com/photos/*
// @include         https://www.flickr.com/photos/*
// @include         https://flickr.com/photos/*
// @exclude         http://www.flickr.com/photos/organize*
// @exclude         http://flickr.com/photos/organize*
// @exclude         https://www.flickr.com/photos/organize*
// @exclude         https://flickr.com/photos/organize*
// @grant           GM_xmlhttpRequest
// ==/UserScript==

// --------------------------------------------------------------------
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
// select "flickr2iper_1photo", and click Uninstall.
//
// Thanks to :
// - http://gdorn.nudio.net/greasemonkey
// - http://www.ipernity.com/home/14353 (Michael)
//
// --------------------------------------------------------------------

/*
  ChangeLog
  =========
  v1.0  19-July-2007 : first release....
  v1.3  20-July-2007 : complete rewriting using the /photo_zoom.gne hack to get original src
  v1.7  28-May-2008 : added option for posted_at
  v1.8  05-Aug-2008 : added debug traces
  v1.9  31-Aug-2010 : compatibility to new Flickr photo page
  v1.10  21-May-2013 : BUGFIX XML response reading from Flickr
  v1.11  28-May-2013 : HTTPS support
  v1.12  19-June-2013 : duplicate support
  v1.13  21-June-2013 : safety support
  v1.14  31-March-2014 : New Flickr layout support
  v1.15  04-April-2014 : bugfixes
  v1.16  26-June-2014 : New Flickr layout support
  v1.17  02-July-2014 : New Flickr layout support
  v1.18  28-July-2014 : add grant for GM_xmlhttpRequest
  v1.19  17-May-2015 : avoid call to Flickr API to get ownership
 */

(function() {

<!--common.js-->

var about = { 'name': 'Flickr 2 Ipernity (1 photo)',
                    'script': 'flickr.1photo',
                    'version': '1.19' };

console.info(about.name+": script loading...");

  var currentLocation = w.document.location.href;
  var global_auth_hash, global_auth_token,hostname, api_key, auth_hash, auth_token, secret, photo_id, photos_url, user_nsid = null;

  function initFromNewPage() {
    if(w.F && w.F.config) {
      var conf = w.F.config;
      global_auth_hash=conf.flickrAPI.auth_hash;
      global_auth_token=conf.flickrAPI.auth_token;
      photos_url=conf.flickr.user.photos_url;
      hostname=w.document.location.href.split('/')[2];

      api_key = conf.flickrAPI.api_key;
      auth_hash =conf.flickrAPI.auth_hash;
      auth_token= conf.flickrAPI.auth_token;
      secret    = conf.flickrAPI.secret;

      photo_id = conf.flickr.photo.id;

    }
    else if(w.YUI_config && w.YUI_config.flickr && w.YUI_config.flickr.api) {
      // Hermes interface

      api_key = w.YUI_config.flickr.api.site_key;

      var canonicalURL = document.querySelector("meta[property='og:url']")
        ? document.querySelector("meta[property='og:url']").getAttribute('content')
        : null;
      if (canonicalURL !== null) {
        var matches = canonicalURL.match(/photos\/[^\/]+\/(\d+)/);
        photo_id = matches[1];
      }

      if (w.auth && w.auth.user) {
        user_nsid = w.auth.user.nsid;
      }
      else {
        console.warn("Cannot get nsid");
        return;
      }
    }
    else {
      global_auth_hash=w.global_auth_hash;
      global_auth_token=w.global_auth_token;
      photos_url=w.photos_url;
      hostname=w.document.location.href.split('/')[2];

      api_key = w.global_magisterLudi;
      auth_hash = w.global_auth_hash;
      auth_token= w.global_auth_token;
      secret = w.global_flickr_secret;

      photo_id = w.page_photo_id;
    }
  }

  initFromNewPage();

  // if no photos_url, check later with user_nsid
  var isOwner = photos_url ? (photo_id && w.document.location.href.indexOf(photos_url)>0) : true;

  console.log("photo_id="+photo_id+", api_key="+api_key+" isOwner="+isOwner);

  if(!isOwner) {
       console.warn("Not photopage owner");
       return;
  }

  if(photos_url && w.document.location.href.indexOf(photos_url+photo_id)<=0) {
       console.warn("Not photopage");
       return;
  }

  // check update & session

  check_update();
  check_session();

  // say hello

  document.title = document.title+" ["+about.name+" v"+about.version+"]";

  // our div

  var div;
  function create_div() {
    div = document.createElement("DIV");
    div.id = "iol_import";
    div.style.width="240px";
    div.style.height="40px";
    div.style.border="solid 1px #ccc";
    div.style.backgroundColor="#111111";
    div.style.padding="10px";
    div.style.marginBottom="10px";
    div.innerHTML="loading photo infos...";
    div.style.display="none";

    if (_ge('About')) {
      var last = _ge('About').getElementsByTagName('div')[0];
      _ge('About').insertBefore(div, last);
    } 
    else if (_ge('meta')) {
      var last = _ge('meta').getElementsByTagName('div')[0];
      _ge('meta').insertBefore(div, last);
    }
    else if (document.getElementsByClassName('photo-title-desc-view')[0]) {
      var root = document.getElementsByClassName('photo-title-desc-view')[0];
      root.insertBefore(div, root.getElementsByTagName('div')[0]);
    }
    else if (document.getElementsByClassName('sub-photo-view')[0]) {
      div.style.backgroundColor = "#EEEEEE";
      div.style.cssFloat = "right";

      var root = document.getElementsByClassName('sub-photo-view')[0];
      root.insertBefore(div, root.getElementsByTagName('div')[0]);
    }
    else {
      var body = getElementsByTagName('body')[0];
      body.insertBefore(div, body.lastChild);
    }

  }

	// get & parse photo infos

  function get_photo() {
    if (document.getElementById("iol_import")) {
      document.getElementById("iol_import").remove();
    }
    create_div();
    
    console.log("Flickr API flickr.photos.getInfo for photo_id="+photo_id);
    request('flickr.photos.getInfo',{photo_id: photo_id},'parse_photo');

	}

	window['parse_photo'] = function(ok,xml,txt,params) {

	       function fix_perm(p)  { p=_pi(p); var f = {3:15, 2:7, 1:3 }; return (f[p])? f[p]:0;  }
	       function fix_lic(p)   { p = _pi(p); var f = {4:1, 6:5, 3:7, 2:3, 1:11, 5:9 }; return (f[p])? f[p]:0;  }

	       if ( ok )
	       {
		      var p = xml.getElementsByTagName('photo')[0];

           // check if it's my photo
           if (user_nsid != null) {
             var owner = xml.getElementsByTagName('owner')[0];
             if (!owner.getAttribute('nsid') || owner.getAttribute('nsid') != user_nsid) {
               div.remove();
               return;
             }
           }
           div.style.display = "block";

          if (!p.getAttribute('media') || p.getAttribute('media') != 'photo') {
            div.innerHTML = "can't import video to ipernity";
            return;
          }

          var visi = xml.getElementsByTagName('visibility')[0];
		      var date = xml.getElementsByTagName('dates')[0];

		      photo = { id        : p.getAttribute('id'),
                    secret    : p.getAttribute('secret'),
                    server    : p.getAttribute('server'),
                    farm      : p.getAttribute('farm'),
                    originalsecret : p.getAttribute('originalsecret'),
                    originalformat : p.getAttribute('originalformat'),
                    dateupload: _pi(date.getAttribute('posted')),
                    datetaken : date.getAttribute('taken'),
                    license   : _pi(p.getAttribute('license')),
                    ispublic  : _pi(visi.getAttribute('ispublic')),
                    isfriend  : _pi(visi.getAttribute('isfriend')),
                    isfamily  : _pi(visi.getAttribute('isfamily')),
                    safety_level : _pi(visi.getAttribute('safety_level'))
			      };

		      if ( p.getElementsByTagName('title')[0] && p.getElementsByTagName('title')[0].firstChild)
		      {
			     photo.title = p.getElementsByTagName('title')[0].firstChild.data;
		      }
		      else { photo.title=""; }

		      if ( p.getElementsByTagName('description')[0] && p.getElementsByTagName('description')[0].firstChild)
		      {
		      photo.description = p.getElementsByTagName('description')[0].firstChild.data;
		      }
		      else { photo.description=""; }

		      // fix share and safety

		      if ( photo.ispublic) photo.share=31;
		      else if ( photo.isfamily && photo.isfriend ) photo.share=3;
		      else if ( photo.isfriend) photo.share=2;
		      else if ( photo.isfamily) photo.share=1;
		      else                      photo.share=0;

           if (photo.safety_level == 0 || photo.safety_level == 1 || photo.safety_level == 2) {
             photo.safety = photo.safety_level + 1;  // right value for ipernity
           }
           else {
             photo.safety = 0;   // unrated value on ipernity
           }

		      // fix perms

		      var perms = xml.getElementsByTagName('permissions')[0];
		      if ( perms )
		      {
			     photo.com   = fix_perm(perms.getAttribute('permcomment'));
			     photo.tag   = fix_perm(perms.getAttribute('permaddmeta'));
			     photo.tagme = fix_perm(perms.getAttribute('permaddmeta'));
		      }
		      else
		      {
			     photo.com =  photo.tag =  photo.tagme = 0;
		      }

		      // fix license

		      photo.license = fix_lic(photo.license);

		      // tags

		      var tag = xml.getElementsByTagName('tag');
		      if ( tag.length )
		      {
			     var tags = [];
			     for(var i=0;i<tag.length;i++)
			     {
				    tags.push(tag[i].getAttribute('raw'));
			     }
			     photo.keywords = tags.join(',');
		      }
		      else
		      {
			     photo.keywords="";
		      }

		      // src

		      if ( photo.originalsecret )
		      {
			     photo.src = "http://farm"+photo.farm+".static.flickr.com/"+photo.server+"/"+photo.id+"_"+photo.originalsecret+"_o."+photo.originalformat;
		      }
		      else
		      {
			     photo.src = "http://farm"+photo.farm+".static.flickr.com/"+photo.server+"/"+photo.id+"_"+photo.secret+"_o.jpg";
		      }

		      photo.thumb = "http://farm"+photo.farm+".static.flickr.com/"+photo.server+"/"+photo.id+"_"+photo.secret+"_s.jpg";

		      var geo = xml.getElementsByTagName('location')[0];
		      if ( geo ) {
			     photo.lat  = _pf(geo.getAttribute('latitude'));
			     photo.lng  = _pf(geo.getAttribute('longitude'));
			     photo.zoom = _pi(geo.getAttribute('accuracy'));
		      }
		      else
		      {
			     photo.lat = 0;
			     photo.lng = 0;
			     photo.zoom = 0;
		      }

		      console.log("photo details:");
		      console.log(photo);

		      // show import

		      show_import();

	       }
	       else
	       {
		      div.innerHTML = 'FAILED to load photo details from Flickr API';
                      
	       }
	};

	// import DIV

	function show_import() {

	       div.innerHTML="";

	       var div_link = document.createElement("a");
	       div_link.href="#";
	       div_link.style.display="block";
	       div_link.style.fontSize="13px";
	       div_link.style.fontWeight="bold";
	       div_link.innerHTML="IMPORT TO IPERNITY";

	       div_link.addEventListener('click', function(e) { import_photo(); e.stopPropagation();  e.preventDefault(); }, true);

         div.appendChild(div_link);

	       var form = document.createElement("form");
	       var cb = document.createElement("input");
	       cb.type="checkbox";
	       cb.id="keep-postedat";
	       cb.name="postedat";
	       cb.checked=true;
	       var label = document.createElement("label");
	       label.setAttribute("for",cb.id);
	       label.innerHTML="<b>Keep the Flickr posted date </b>";
	       form.appendChild(cb);
	       form.appendChild(label);
         div.appendChild(form);
	}

	// import Photo

	function import_photo() {

	       params = { 'title'      : photo.title,
			  'content'    : photo.description,
			  'keywords'   : photo.keywords,
			  'share'      : photo.share,
			  'com'        : photo.com,
			  'tag'        : photo.tag,
			  'tagme'      : photo.tagme,
			  'lat'        : photo.lat,
			  'lng'        : photo.lng,
			  'zoom'       : photo.zoom,
			  'src'        : photo.src,
			  'posted_at'  : photo.dateupload,
			  'created_at' : photo.datetaken,
			  'license'    : photo.license,
        'provider'   : 'flickr',
        'provider_id': photo.id,
        'safety'     : photo.safety
			};

	       if ( _ge("keep-postedat").checked==false ) { delete params.posted_at; }

	       div.innerHTML="Importing photo...";

	       console.info("importing photo :");
	       console.log(params);

	       GM_xmlhttpRequest({
					method: 'POST',
					url: "http://"+iol_host+'/api.iol.php/doc.new.src/json',
					headers: {
					       'User-agent' : navigator.userAgent,
					       'Accept': 'application/atom+xml,application/xml,text/xml',
					       'Content-Type' : 'application/x-www-form-urlencoded'
					},

					data: encode_params(params),

					onload: function(responseDetails) { import_photo_callback(responseDetails); },
					onerror: function(responseDetails) { div.innerHTML="FAILED : please try again later"; }
				 });
	}

	var import_photo_callback= function(ajx) {

	       try { var rsp = eval('('+ajx.responseText+')'); }
	       catch(e) { var rsp = {}; }

	       var success = (rsp.status>0)?true:false;

	       if ( success)
	       {
		      div.innerHTML="Done!";
		      console.info("Photo successfully imported.");
	       }
	       else
	       {
		      var errid = rsp.error.id;
		      var error = '';
		      switch(errid) {
		      case 1 : error='Original photo source not found';
			     break;
		      case 3 : error='Your ipernity quota is exceeded';
			     break;
		      case 105 : error='Your ipernity session has expired';
			     break;
		      default : error='An error #'+errid+' occured. Sorry about this!';

			     if ( debug_mode ) console.warn(rsp);
		      }
		      div.innerHTML="Sorry : "+error;

		      console.warn("Error: "+error);
	       }
	};


	function escape_utf8(str) {
	       if ( str=="0" ) return 0;
	       if ( str==""||str==null||! str) { return ""; }

	       str = str.toString();

	       // encode in UTF-8

	       var c, s;
	       var enc = "";
	       var i = 0;
	       while(i<str.length) {
		      c= str.charCodeAt(i++);

		      // handle UTF-16 surrogates
		      if (c>=0xDC00 && c<0xE000) continue;
		      if (c>=0xD800 && c<0xDC00) {
			     if (i>=str.length) continue;
			     s= str.charCodeAt(i++);
			     if (s<0xDC00 || c>=0xDE00) continue;
			     c= ((c-0xD800)<<10)+(s-0xDC00)+0x10000;
		      }
		      // output value
		      if (c<0x80) enc += String.fromCharCode(c);
		      else if (c<0x800) enc += String.fromCharCode(0xC0+(c>>6),0x80+(c&0x3F));
		      else if (c<0x10000) enc += String.fromCharCode(0xE0+(c>>12),0x80+(c>>6&0x3F),0x80+(c&0x3F));
		      else enc += String.fromCharCode(0xF0+(c>>18),0x80+(c>>12&0x3F),0x80+(c>>6&0x3F),0x80+(c&0x3F));
	       }

	       // encode URI

	       var okURIchars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";

	       str = enc;
	       enc = "";

	       for (var i= 0; i<str.length; i++) {
		      if (okURIchars.indexOf(str.charAt(i))==-1)
			     enc += "%"+to_hex(str.charCodeAt(i));
		      else
			     enc += str.charAt(i);
	       }
	       return enc;
	}

	function to_hex(n) {
	       var hexchars = "0123456789ABCDEF";
	       return hexchars.charAt(n>>4)+hexchars.charAt(n & 0xF);
	}

  function request(method,params,callback) {
    commonRequest(method,params,callback,'1photo');
  }

	function request_callback(result,params,callback)	{
	       if( result.status != 200 ) alert(about.name+': Call to Flickr API has failed.');

	       var txt = result.responseText;
         var parser = new DOMParser();
         var xml = parser.parseFromString(txt, "application/xml");

	       if ( ! window[callback] ) alert(about.name+': no callback = '+callback);

	       var rsp = xml.getElementsByTagName('rsp')[0];

	       if ( rsp && rsp.getAttribute('stat')=="ok" )
	       {
		      return window[callback](1,xml,txt,params);
	       }
	       else
	       {
		      if ( ! rsp ) { alert(about.name+": API failed: "+result.responseText); }
		      else         { return window[callback](0); }
	       }
	}

	var nibble_to_hex=function(s)
	{
	       var h="0123456789ABCDEF";
	       return h.charAt(s);
	};

	// (c) flickr 'md5.js'

	var md5_hex_chr="0123456789abcdef";
	function md5_rhex(_1){str="";for(j=0;j<=3;j++){str+=md5_hex_chr.charAt((_1>>(j*8+4))&15)+md5_hex_chr.charAt((_1>>(j*8))&15);}return str;}function md5_str2blks_MD5(_2){nblk=((_2.length+8)>>6)+1;blks=new Array(nblk*16);for(i=0;i<nblk*16;i++){blks[i]=0;}for(i=0;i<_2.length;i++){blks[i>>2]|=_2.charCodeAt(i)<<((i%4)*8);}blks[i>>2]|=128<<((i%4)*8);blks[nblk*16-2]=_2.length*8;return blks;}function md5_add(x,y){var _5=(x&65535)+(y&65535);var _6=(x>>16)+(y>>16)+(_5>>16);return (_6<<16)|(_5&65535);}function md5_rol(_7,_8){return (_7<<_8)|(_7>>>(32-_8));}function md5_cmn(q,a,b,x,s,t){return md5_add(md5_rol(md5_add(md5_add(a,q),md5_add(x,t)),s),b);}function md5_ff(a,b,c,d,x,s,t){return md5_cmn((b&c)|((~b)&d),a,b,x,s,t);}function md5_gg(a,b,c,d,x,s,t){return md5_cmn((b&d)|(c&(~d)),a,b,x,s,t);}function md5_hh(a,b,c,d,x,s,t){return md5_cmn(b^c^d,a,b,x,s,t);}function md5_ii(a,b,c,d,x,s,t){return md5_cmn(c^(b|(~d)),a,b,x,s,t);}function md5_calcMD5(str){x=md5_str2blks_MD5(str);a=1732584193;b=-271733879;c=-1732584194;d=271733878;for(i=0;i<x.length;i+=16){olda=a;oldb=b;oldc=c;oldd=d;a=md5_ff(a,b,c,d,x[i+0],7,-680876936);d=md5_ff(d,a,b,c,x[i+1],12,-389564586);c=md5_ff(c,d,a,b,x[i+2],17,606105819);b=md5_ff(b,c,d,a,x[i+3],22,-1044525330);a=md5_ff(a,b,c,d,x[i+4],7,-176418897);d=md5_ff(d,a,b,c,x[i+5],12,1200080426);c=md5_ff(c,d,a,b,x[i+6],17,-1473231341);b=md5_ff(b,c,d,a,x[i+7],22,-45705983);a=md5_ff(a,b,c,d,x[i+8],7,1770035416);d=md5_ff(d,a,b,c,x[i+9],12,-1958414417);c=md5_ff(c,d,a,b,x[i+10],17,-42063);b=md5_ff(b,c,d,a,x[i+11],22,-1990404162);a=md5_ff(a,b,c,d,x[i+12],7,1804603682);d=md5_ff(d,a,b,c,x[i+13],12,-40341101);c=md5_ff(c,d,a,b,x[i+14],17,-1502002290);b=md5_ff(b,c,d,a,x[i+15],22,1236535329);a=md5_gg(a,b,c,d,x[i+1],5,-165796510);d=md5_gg(d,a,b,c,x[i+6],9,-1069501632);c=md5_gg(c,d,a,b,x[i+11],14,643717713);b=md5_gg(b,c,d,a,x[i+0],20,-373897302);a=md5_gg(a,b,c,d,x[i+5],5,-701558691);d=md5_gg(d,a,b,c,x[i+10],9,38016083);c=md5_gg(c,d,a,b,x[i+15],14,-660478335);b=md5_gg(b,c,d,a,x[i+4],20,-405537848);a=md5_gg(a,b,c,d,x[i+9],5,568446438);d=md5_gg(d,a,b,c,x[i+14],9,-1019803690);c=md5_gg(c,d,a,b,x[i+3],14,-187363961);b=md5_gg(b,c,d,a,x[i+8],20,1163531501);a=md5_gg(a,b,c,d,x[i+13],5,-1444681467);d=md5_gg(d,a,b,c,x[i+2],9,-51403784);c=md5_gg(c,d,a,b,x[i+7],14,1735328473);b=md5_gg(b,c,d,a,x[i+12],20,-1926607734);a=md5_hh(a,b,c,d,x[i+5],4,-378558);d=md5_hh(d,a,b,c,x[i+8],11,-2022574463);c=md5_hh(c,d,a,b,x[i+11],16,1839030562);b=md5_hh(b,c,d,a,x[i+14],23,-35309556);a=md5_hh(a,b,c,d,x[i+1],4,-1530992060);d=md5_hh(d,a,b,c,x[i+4],11,1272893353);c=md5_hh(c,d,a,b,x[i+7],16,-155497632);b=md5_hh(b,c,d,a,x[i+10],23,-1094730640);a=md5_hh(a,b,c,d,x[i+13],4,681279174);d=md5_hh(d,a,b,c,x[i+0],11,-358537222);c=md5_hh(c,d,a,b,x[i+3],16,-722521979);b=md5_hh(b,c,d,a,x[i+6],23,76029189);a=md5_hh(a,b,c,d,x[i+9],4,-640364487);d=md5_hh(d,a,b,c,x[i+12],11,-421815835);c=md5_hh(c,d,a,b,x[i+15],16,530742520);b=md5_hh(b,c,d,a,x[i+2],23,-995338651);a=md5_ii(a,b,c,d,x[i+0],6,-198630844);d=md5_ii(d,a,b,c,x[i+7],10,1126891415);c=md5_ii(c,d,a,b,x[i+14],15,-1416354905);b=md5_ii(b,c,d,a,x[i+5],21,-57434055);a=md5_ii(a,b,c,d,x[i+12],6,1700485571);d=md5_ii(d,a,b,c,x[i+3],10,-1894986606);c=md5_ii(c,d,a,b,x[i+10],15,-1051523);b=md5_ii(b,c,d,a,x[i+1],21,-2054922799);a=md5_ii(a,b,c,d,x[i+8],6,1873313359);d=md5_ii(d,a,b,c,x[i+15],10,-30611744);c=md5_ii(c,d,a,b,x[i+6],15,-1560198380);b=md5_ii(b,c,d,a,x[i+13],21,1309151649);a=md5_ii(a,b,c,d,x[i+4],6,-145523070);d=md5_ii(d,a,b,c,x[i+11],10,-1120210379);c=md5_ii(c,d,a,b,x[i+2],15,718787259);b=md5_ii(b,c,d,a,x[i+9],21,-343485551);a=md5_add(a,olda);b=md5_add(b,oldb);c=md5_add(c,oldc);d=md5_add(d,oldd);}return md5_rhex(a)+md5_rhex(b)+md5_rhex(c)+md5_rhex(d);}

  // load info for current photo
  // need to wait 2 seconds to get a CSRF token in w.YUI_config.flickr.csrf.token
  setTimeout(function(){get_photo();}, 4000);

  function checkLocation() {
    if (w.document.location.href != currentLocation) {
      currentLocation = w.document.location.href;
      initFromNewPage();
      get_photo();
    }
  }
  // if location change, we need to load info for new photo
  setInterval(checkLocation, 1000);



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
    
  if (div) {
    checkIfOwner(div);
  }
    
}) ();



