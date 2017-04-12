var cheerio = require('cheerio');
const request = require('request');
const MAX_RESULT = 2;
module.exports = {
  network_search: function (query_string, callback) {
    request({
      method: 'GET',
      url: 'https://www.googleapis.com/customsearch/v1',
      qs: {
        'key': 'AIzaSyCMGfdDaSfjqv5zYoS0mTJnOT3e9MURWkU',
        'cx': '006605420746493289825:wnrdhyxrou4',
        'q': query_string,
        'start': 1
      },
      json: true
    }, function (err, response, body) {
      console.log('err', JSON.stringify(body));
      console.log(body)
      var content = [];
      if (body && body.items.length > 0) {
        content.push({
          'title': body.items[0].title,
          'desc': body.items[0].snippet,
          'link': body.items[0].link
        })
        content.push({
          'title': body.items[1].title,
          'desc': body.items[1].snippet,
          'link': body.items[1].link
        })
      }
      callback(content)
    })
  },
  general_search: function (query_string, callback) {
    console.log('Search query : ' + query_string)
    request({
      method: 'GET',
      url: 'https://www.rackspace.com/en-in/searchresults?query=' + query_string
    }, function (err, response, body) {
      if (err) return console.error(err);
      // Tell Cherrio to load the HTML
      $ = cheerio.load(body);
      var content = [];

      $('h4').each(function (i, el) {
        if (i < MAX_RESULT) {
          let title = $(this).text();
          let link = $('a', this).attr('href');
          let excerpt = $(this).next('p').text();
          let data = {
            title: title,
            link: link,
            desc: excerpt
          };
          content.push(data);
        }
      });
      callback(content);
    });
  }
}
