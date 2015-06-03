
//
// Common
//

function _gt(e) { return document.getElementsByTagName(e); }
function _gi(e) { return document.getElementById(e); }
function _ge(e) { return document.getElementById(e); }
function _ce(e) { return document.createElement(e); }
function _ct(e) { return document.createTextNode(e); }
function _pi(e) { return parseInt(e); }
function _pf(e) { return parseFloat(e); }

var w = (typeof unsafeWindow != "undefined" && unsafeWindow) ? unsafeWindow : window;

//
// console
//

if ( typeof w['console'] === "undefined")
{
  var n = function(){};
  w['console'] = {debug:n, log:n, info:n, warn:n, error:n, assert:n, dir:n, dirxml:n, trace:n, group:n, groupEnd:n, time:n, timeEnd:n, profile:n, profileEnd:n, count:n };
}

console = w['console'];


// check XML Http request

if(typeof GM_xmlhttpRequest === "undefined") {
  alert(about.name+": Sorry, Your browser does not support GM XMLHTTPRequest.\nCheck your browser config.\n(You cannot use OSX Creammonkey.)");
  console.warn("Your browser does not support GM xmlhttpRequest");
  return;
}

// debug_mode

var original_title=document.title;

var debug_mode = (document.location.href.indexOf('?debugmode')>0 ? true: false);

if ( debug_mode ) {
  var iol_host = "www.ipernity.dev2";
  document.title+=" [DEBUG]";
}
else {
  var iol_host = "www.ipernity.com";
}
var iol_api_url = "http://"+iol_host+"/api.iol.php";


// Already imported photos on ipernity
var iperPhotos = new Array();
var iperAlbums = new Array();
var iperCountURLJobs = null;
var iperSponsorLink = null;

var url_update = "http://"+iol_host+"/apps/gm";
var url_update_messenger = "http://"+iol_host+"/invite/flickr";

//
// check update
//

function check_update() {

  console.info("GM "+about.name+": Checking for update....");

  var url = "http://"+iol_host+"/E/Greasemonkey/gm.php/version/"+about.script;

  console.log("checking url = "+url);

  GM_xmlhttpRequest({
    method: 'GET',
    url: url+'?'+(new Date().getTime()),

    onload: function(result) {
      var v = parseFloat(result.responseText);
      var s = "GM "+about.name+": ";

      console.log(s+"version found="+v);

      if ( !isNaN(v) && about.version != v )
      {
        console.warn(s+"You should update to version "+v);

        if ( confirm("Please update GreaseMonkey plugin " + about.name + " to version "+v) ) {
          if (about.script == 'flickr.messenger') {
            document.location = url_update_messenger;
          }
          else {
            document.location = url_update;
          }
        }
      }
      else
      {
        console.info(s+"You have the latest version v "+v);
      }
    }
  });
}

//
// check session
//

function check_session() {

  console.info("Checking session...");

  var url = iol_api_url + "/session.refresh/json";

  var msg = about.name+": Sorry, we couldn't check that you have an alive session on ipernity.\nPlease open a browser window or tab on ipernity.com and make sure you're signed in.";

  GM_xmlhttpRequest({
    method: 'POST',
    url: url,
    headers: {
      'Accept': 'application/atom+xml,application/xml,text/xml',
      'Content-Type' : 'application/x-www-form-urlencoded'
    },

    onload: function(ajx) {
      console.log("API replied:");
      console.log(ajx.responseText);

      try { var rsp = eval('('+ajx.responseText+')'); }
      catch(e) { var rsp = {}; }
      var success = (rsp.status>0)?true:false;

      if ( ! success )
      {
        alert(msg);
        console.warn("looks like you're not logged into ipernity.");
      }
      else {
        console.info("session is ok.");
      }
    },
    onerror: function(ajx) { alert(msg); }
  });
}

function commonRequest(method,params,callback,callerScript) {

  var csrfToken = w.YUI_config && w.YUI_config.flickr && w.YUI_config.flickr.csrf && w.YUI_config.flickr.csrf.token;
  if (csrfToken) {
    params.csrf = csrfToken;
    commonRequestNew(method,params,callback,callerScript);
  }
  else {
    commonRequestOld(method,params,callback,callerScript);
  }
}

function commonRequestOld(method,params,callback,callerScript) {

  var api_params = [];
  var api_resturl = '';

  params.src="js";
  params.api_key=api_key;
  params.auth_hash=auth_hash;
  params.auth_token=auth_token;
  params.cb=new Date().getTime();
  params.method = method;

  for(var p in params)
  {
    api_params.push(p);
    api_resturl += "&"+p+"="+escape_utf8(params[p]);
  }

  api_params.sort();

  var cal=secret;

  if(cal!="")
  {
    for(var i=0;i<api_params.length;i++)
    {
      cal+=api_params[i]+params[api_params[i]];
    }

    cal=md5_calcMD5(cal);
    api_resturl="api_sig="+cal+api_resturl;

  }

  params.RESTURL=api_resturl;

  var userAgent = 'Mozilla/4.0 (compatible) Greasemonkey';
  if (callerScript == 'importer' || callerScript == 'album_importer') {
    userAgent = userAgent + ' FlickrContactsTagger';
  }

  GM_xmlhttpRequest({
    method: 'POST',
    url: 'http://www.flickr.com/services/rest/?' + api_resturl,
    headers: { 'User-agent': userAgent,
              'Accept': 'application/atom+xml,application/xml,text/xml' },
    onload: function(result) { request_callback(result,params,callback); }
  });
}

function commonRequestNew(method,params,callback,callerScript) {

  var api_resturl = '';

  params.method = method;
  params.api_key = api_key;

  for(var p in params) {
    api_resturl += "&"+p+"="+escape_utf8(params[p]);
  }
  api_resturl = api_resturl.substring(1);

  var userAgent = 'Mozilla/4.0 (compatible) Greasemonkey';
  if (callerScript == 'importer' || callerScript == 'album_importer') {
    userAgent = userAgent + ' FlickrContactsTagger';
  }

  GM_xmlhttpRequest({
    method: 'POST',
    url: 'https://api.flickr.com/services/rest?' + api_resturl,
    headers: { 'User-agent': userAgent,
      'Accept': 'application/atom+xml,application/xml,text/xml' },
    onload: function(result) { request_callback(result,params,callback); }
  });
}

function encode_params(params,scope) {

  var post = '';
  if  ( params instanceof Array )
  {
    for(var k=0;k<params.length;k++)
    {
      var v = params[k];
      if ( typeof v == "object" ||
        typeof v == "array" ) post += '&'+encode_params(v,scope?scope+'['+k+']':k);

      else if ( scope )
      {
        post += '&'+scope+'['+k+']='+escape_utf8(v);
      }
      else
      {
        post += '&'+k+'='+escape_utf8(v);
      }
    }
  }
  else if ( params instanceof Object )
  {
    for(var k in params)
    {
      var v = params[k];
      if ( typeof v == "object" ||
        typeof v == "array" ) post += '&'+encode_params(v,scope?scope+'['+k+']':k);

      else if ( scope )
      {
        post += '&'+scope+'['+k+']='+escape_utf8(v);
      }
      else
      {
        post += '&'+k+'='+escape_utf8(v);
      }
    }
  }
  return post.substr(1,post.length);
}


//////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

/*
 * return iper album with same title
 * if exists, returns existing
 * if not exists, create iper album
 */
function loadIperAlbum(albumTitle, albumID, callback) {
  if (iperAlbums[albumID]) {
    callback(iperAlbums[albumID]);
    return;
  }

  GM_xmlhttpRequest({
    method: 'POST',
    url: iol_api_url + "/album.search/json",
    headers: {
      'User-agent' : navigator.userAgent,
      'Accept': 'application/atom+xml,application/xml,text/xml',
      'Content-Type' : 'application/x-www-form-urlencoded'
    },
    data: encode_params({'title': albumTitle, 'allow_empty': 1}),

    onload: function(ajx) {
      var iperAlbum = loadIperAlbum_result(ajx);
      if (iperAlbum && iperAlbum.album_id) {
        iperAlbums[albumID] = iperAlbum;
        callback(iperAlbum);
      }
      else {  // iperAlbum with albumTitle not exists, so we create it
        createIperAlbum(albumTitle, albumID, callback);
      }
    },
    onerror: function(ajx) {
      divs['launcher'].innerHTML="photo "+photo.title+" FAILED"; console.warn(ajx);
    }
  });
}

function loadIperAlbum_result(ajx) {

  try { var rsp = eval('('+ajx.responseText+')'); }
  catch(e) { var rsp = {}; console.warn(ajx.responseText); }

  var success = (rsp.status>0)?true:false;
  if (success) {
    if (rsp.albums && rsp.albums.length) {
      return rsp.albums[0];
    }
    return null;
  }
  else {
    var errid = rsp.error.id;
    var error = '';
    switch(errid) {
      default : error='An error #'+errid+' occurred. sorry about that.';
    }
    msg("Sorry : "+error);
    console.warn(error);
  }
  return null;
}


/*
 * create iper album and return it
 */
function createIperAlbum(albumTitle, albumID, callback) {

  var metaDescription = document.querySelector("meta[name='description']")
    ? document.querySelector("meta[name='description']").getAttribute('content')
    : null;
  var description = (metaDescription == albumTitle) ? '' : metaDescription;

  GM_xmlhttpRequest({
    method: 'POST',
    url: iol_api_url + "/album.add/json",
    headers: {
      'User-agent' : navigator.userAgent,
      'Accept': 'application/atom+xml,application/xml,text/xml',
      'Content-Type' : 'application/x-www-form-urlencoded'
    },
    data: encode_params({'title': albumTitle, 'content': description}),

    onload: function(ajx) {
      var iperAlbum = createIperAlbum_result(ajx);
      if (iperAlbum && iperAlbum.album_id) {
        iperAlbums[albumID] = iperAlbum;
        callback(iperAlbum);
      }
      else {  // can't create iperAlbum !!
        divs['launcher'].innerHTML="album "+albumTitle+" FAILED"; console.warn(ajx);
      }
    },
    onerror: function(ajx) {
      divs['launcher'].innerHTML="photo "+photo.title+" FAILED"; console.warn(ajx);
    }
  });
}

function createIperAlbum_result(ajx) {

  try { var rsp = eval('('+ajx.responseText+')'); }
  catch(e) { var rsp = {}; console.warn(ajx.responseText); }

  var success = (rsp.status>0)?true:false;
  if (success) {
    return rsp.album ? rsp.album : null;
  }
  else {
    var errid = rsp.error.id;
    var error = '';
    switch(errid) {
      default : error='An error #'+errid+' occurred. sorry about that.';
    }
    msg("Sorry : "+error);
    console.warn(error);
  }
  return null;
}


/*
 * set iper album cover
 */
function setIperAlbumCover(iperAlbum, flickrID, callback, noLoad) {

  var iperPhoto = getIperPhoto(flickrID);
  if (!iperPhoto && !noLoad) {
    loadIperPhotos([flickrID], function(iperAlbum, flickrID, callback){
      return function() {
        setIperAlbumCover(iperAlbum, flickrID, callback, true);
      };
    }(iperAlbum, flickrID, callback));
    return;
  }

  if (!iperPhoto) {  // cover is not imported on ipernity yet
    callback(false);
  }
  else {
    GM_xmlhttpRequest({
      method: 'POST',
      url: iol_api_url + "/album.set.cover/json",
      headers: {
        'User-agent' : navigator.userAgent,
        'Accept': 'application/atom+xml,application/xml,text/xml',
        'Content-Type' : 'application/x-www-form-urlencoded'
      },
      data: encode_params({'album_id': iperAlbum.album_id, 'doc_id': iperPhoto.doc_id}),

      onload: function(ajx) {
        var success = setIperAlbumCover_result(ajx);
        if (success) {
          callback(true);
        }
        else {  // can't set cover !!
          divs['launcher'].innerHTML="set album cover FAILED"; console.warn(ajx);
        }
      },
      onerror: function(ajx) {
        divs['launcher'].innerHTML="set album cover FAILED"; console.warn(ajx);
      }
    });
  }
}

function setIperAlbumCover_result(ajx) {

  try { var rsp = eval('('+ajx.responseText+')'); }
  catch(e) { var rsp = {}; console.warn(ajx.responseText); }

  var success = (rsp.status>0)?true:false;
  if (success) {
    return true;
  }
  else {
    var errid = rsp.error.id;
    var error = '';
    switch(errid) {
      default : error='An error #'+errid+' occurred. sorry about that.';
    }
    msg("Sorry : "+error);
    console.warn(error);
  }
  return false;
}


/*
 * load iperPhotos from iper API
 */
function loadIperPhotos(photosIDs, callback) {

  GM_xmlhttpRequest({
    method: 'POST',
    url: iol_api_url + "/doc.flickr.get/json",
    headers: {
      'User-agent' : navigator.userAgent,
      'Accept': 'application/atom+xml,application/xml,text/xml',
      'Content-Type' : 'application/x-www-form-urlencoded'
    },
    data: encode_params({'photoIDs': photosIDs}),

    onload: function(ajx) {
      var otherIperPhotos = loadIperPhotos_result(ajx);
      for (var flickrID in otherIperPhotos) {
        if (otherIperPhotos.hasOwnProperty(flickrID) && otherIperPhotos[flickrID]) {
          iperPhotos[flickrID+""] = {'doc_id': otherIperPhotos[flickrID]};
        }
      }
      callback();
    },
    onerror: function(ajx) {
      divs['launcher'].innerHTML="photo "+photo.title+" FAILED"; console.warn(ajx);
    }
  });
}

function loadIperPhotos_result(ajx) {

  try { var rsp = eval('('+ajx.responseText+')'); }
  catch(e) { var rsp = {}; console.warn(ajx.responseText); }

  var success = (rsp.status>0)?true:false;
  if (success) {
    return rsp.docs;
  }
  else {
    var errid = rsp.error.id;
    var error = '';
    switch(errid) {
      case 1 : error='Arguments error'; break;
      default : error='An error #'+errid+' occurred. sorry about that.';
    }
    msg("Sorry : "+error);
    console.warn(error);
  }
  return [];
}

/*
 * return an iperdoc object if photoID is imported on ipernity user account
 */
function getIperPhoto(photoID) {
  if (typeof iperPhotos[photoID] != 'undefined') {
    return iperPhotos[photoID];
  }
  return null;
}


/*
 * get count photos being processed on ipernity
 */
function loadCountURLJobs(callback) {

  GM_xmlhttpRequest({
    method: 'POST',
    url: iol_api_url + "/doc.upload.countUrlJobs/json",
    headers: {
      'User-agent' : navigator.userAgent,
      'Accept': 'application/atom+xml,application/xml,text/xml',
      'Content-Type' : 'application/x-www-form-urlencoded'
    },
    data: encode_params({}),

    onload: function(ajx) {
      iperCountURLJobs = loadCountURLJobs_result(ajx);
      callback();
    },
    onerror: function(ajx) {
      divs['launcher'].innerHTML="photo "+photo.title+" FAILED"; console.warn(ajx);
    }
  });
}

function loadCountURLJobs_result(ajx) {

  try { var rsp = eval('('+ajx.responseText+')'); }
  catch(e) { var rsp = {}; console.warn(ajx.responseText); }

  var success = (rsp.status>0)?true:false;
  if (success) {
    return parseInt(rsp.jobs.count);
  }
  else {
    var errid = rsp.error.id;
    var error = '';
    switch(errid) {
      default : error='An error #'+errid+' occurred. sorry about that.';
    }
    msg("Sorry : "+error);
    console.warn(error);
  }
  return null;
}

function getCountURLJobs() {
  return iperCountURLJobs;
}


/*
 * get ipernity sponsor code
 */
function loadIperSponsorLink(callback) {

  GM_xmlhttpRequest({
    method: 'POST',
    url: iol_api_url + "/user.sponsorship.getLink/json",
    headers: {
      'User-agent' : navigator.userAgent,
      'Accept': 'application/atom+xml,application/xml,text/xml',
      'Content-Type' : 'application/x-www-form-urlencoded'
    },
    data: encode_params({}),

    onload: function(ajx) {
      iperSponsorLink = loadIperSponsorLink_result(ajx);
      callback();
    },
    onerror: function(ajx) {
      console.warn(ajx);
    }
  });
}

function loadIperSponsorLink_result(ajx) {

  try { var rsp = eval('('+ajx.responseText+')'); }
  catch(e) { var rsp = {}; console.warn(ajx.responseText); }

  var success = (rsp.status>0)?true:false;
  if (success) {
    return rsp.sponsor_link;
  }
  else {
    var errid = rsp.error.id;
    var error = '';
    switch(errid) {
      default : error='An error #'+errid+' occurred. sorry about that.';
    }
    msg("Sorry : "+error);
    console.warn(error);
  }
  return null;
}

function getIperSponsorLink() {
  return iperSponsorLink;
}





//
// second_getInfos
//

var second_getInfos = function(photo_id) {

  var photo = photos[photo_id];
  request('flickr.photos.getInfo',{photo_id:photo.id,secret:photo.secret},'second_getInfos_onApi');
};

var second_getInfos_onApi = function(ok,xml,txt,params) {

  var  t = '';

  if ( ok )
  {
    var p = xml.getElementsByTagName('photo')[0];
    var photo_id = p.getAttribute('id');

    var photo = photos[photo_id];

    if ( photo )
    {
      // share / safety
      var visibility = xml.getElementsByTagName('visibility')[0];
      photo.ispublic = _pi(visibility.getAttribute('ispublic'));
      photo.isfamily = _pi(visibility.getAttribute('isfamily'));
      photo.isfriend = _pi(visibility.getAttribute('isfriend'));
      photo.safety_level = _pi(visibility.getAttribute('safety_level'));

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

      // description

      var desc = xml.getElementsByTagName('description')[0];
      if (desc && desc.firstChild) photo.content = desc.firstChild.data;
      else        photo.content = "";

      // permissions

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

      photo.license = fix_lic(photo.license);

      // tags
      // <tag id="2143674-571067849-12275" author="93408634@N00" raw="Un" machine_tag="0">un</tag>

      var tag = xml.getElementsByTagName('tag');
      if ( tag.length )
      {
        var tags = [];
        for(var i=0;i<tag.length;i++)
        {
          tags.push(tag[i].getAttribute('raw'));
        }
        photo.keywords = tags.join(',');
        console.log("tags = "+photo.tags);
      }
      else
      {
        photo.keywords="";
        console.log("tags null");
      }

      // note
      // <notes><note id="XXX" author="YYY" x=X y=Y w=W h=H>the note</note>...</notes>
      //
      // we only import author's notes.
      // (!) notes are not imported at the moment.

      var thenotes = xml.getElementsByTagName('note');
      var notes = [];
      if ( thenotes.length )
      {
        for(var i=0;i<thenotes.length;i++)
        {
          var note = thenotes[i];
          var author = note.getAttribute('author');

          if ( author == global_nsid )
          {
            notes.push(
              {x1 : _pi(note.getAttribute('x')),
                y1 : _pi(note.getAttribute('y')),
                x2 : _pi(note.getAttribute('x'))+_pi(note.getAttribute('w')),
                y2 : _pi(note.getAttribute('y'))+_pi(note.getAttribute('h')),
                content : note.innerHTML
              });
          }
        }
      }

      // lat, lng

      photo.lat = photo.latitude || 0;
      photo.lng = photo.longitude || 0;
      photo.zoom = photo.accuracy || 0;

      // src
      /*
       if ( photo.originalsecret )
       photo.src  = "http://farm"+photo.farm+".static.flickr.com/"+photo.server+"/"+photo.id+"_"+photo.originalsecret+"_o."+photo.originalformat;
       else
       photo.src  = "http://farm"+photo.farm+".static.flickr.com/"+photo.server+"/"+photo.id+"_"+photo.secret+"_o.jpg";
       */

      photo.thumb = "http://farm"+photo.farm+".static.flickr.com/"+photo.server+"/"+photo.id+"_"+photo.secret+"_s.jpg";

      if ( previews[photo.id] )	preview.removeChild(previews[photo.id]);

      // preview

      preview_img.src = photo.thumb;
      preview_txt.innerHTML = "<h3>Importing '"+photo.title+"'</h3>"+"<small>(Tags: "+photo.keywords+")</small>";

      console.info("importing photo="+photo.id);
      console.log(photo);

      // import photo

      var params = { 'title'      : photo.title,
        'content'    : photo.content,
        'keywords'   : photo.keywords,
        'share'      : photo.share,
        'com'        : photo.com,
        'tag'        : photo.tag,
        'tagme'      : photo.tagme,
        'lat'        : photo.lat,
        'lng'        : photo.lng,
        'src'        : photo.source,
        'posted_at'  : photo.dateupload,
        'created_at' : photo.datetaken,
        'license'    : photo.license,
        'provider'   : 'flickr',
        'provider_id': photo.id,
        'safety'     : photo.safety
      };
      if(params.keywords==="") delete params.keywords;
      if(params.content==="") delete params.content;
      if(params.license==0) delete params.license;

      console.log("XmlHTTP Request");

      GM_xmlhttpRequest({
        method: 'POST',
        url: iol_api_url + "/doc.new.src/json",
        headers: {
          'User-agent' : navigator.userAgent,
          'Accept': 'application/atom+xml,application/xml,text/xml',
          'Content-Type' : 'application/x-www-form-urlencoded'
        },

        data: encode_params(params),

        onload: function(ajx) { import_result(ajx,photo); },
        onerror: function(ajx) { divs['launcher'].innerHTML="photo "+photo.title+" FAILED"; console.warn(ajx); }
      });
    }
  }

  setTimeout( function() { import_photos();},1500);
};
window['second_getInfos_onApi']=second_getInfos_onApi;

function import_result(ajx,photo) {

  try { var rsp = eval('('+ajx.responseText+')'); }
  catch(e) { var rsp = {}; console.warn(ajx.responseText); }

  var success = (rsp.status>0)?true:false;

  if ( success) {
    msg("photo "+photo.title+" OK");
    console.info("ok.");
  }
  else             {
    var errid = rsp.error.id;
    var error = '';
    switch(errid) {
      case 1 : error='Original photo source not found'; break;
      case 3 : error='Your ipernity quota is exceeded'; break;
      case 105 : error='Your ipernity session has expired'; break;
      default : error='An error #'+errid+' occurred. sorry about that.';
    }
    msg("Sorry : "+error);
    console.warn(error);
  }
}