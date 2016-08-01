var key = 'AIzaSyAXAHWhEfhrYyusjGymG_Hb5qg7p_nioV4';
var origin = 'https://www.googleapis.com/youtube/v3/';

module.exports = createClient;

function createClient(request) {
  var api = {
    get: get,
    getChannelInfo: getChannelInfo
  };

  return api;

  function getChannelInfo(channelId) {
    return get('channels', {
      part: 'statistics,snippet',
      id: channelId
    }).then(function(response) {
      if (response.items && response.items.length) {
        return toChannelInfo(response.items[0]);
      }
    });
  }

  function get(path, params) {
    var qs = buildParameters(params);
    var dataUrl = origin + path + '?' + qs;

    return request(dataUrl, {
      responseType: 'json'
    });
  }
}

function toChannelInfo(response) {
  var snippet = response.snippet;
  var info = {
    id: response.id,
    title: snippet.title,
    description: snippet.description,
  };

  if (snippet.thumbnails) {
    info.thumbnail = snippet.thumbnails.default;
  }

  return Object.assign(info, response.statistics);
}

function buildParameters(request) {
    request.key = key;

    return Object.keys(request).map(function(key) {
      return key + '=' + window.encodeURIComponent(request[key])
    }).join('&');
}

