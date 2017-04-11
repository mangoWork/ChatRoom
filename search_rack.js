var cheerio = require('cheerio');
const request = require('request');
const MAX_RESULT = 2;
module.exports = function (query_string, callback) {
  console.log('Search query : ' + query_string)
  request({
    method: 'GET',
    url: 'https://www.rackspace.com/en-in/searchresults?query=' + query_string
  }, function (err, response, body) {
    if (err) return console.error(err);
    // Tell Cherrio to load the HTML
    //console.log(body);
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
          excerpt: excerpt
        };
        content.push(data);
      }
    });
    callback(content);
  });
}
