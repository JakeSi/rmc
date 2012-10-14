require(
['ext/jquery', 'ext/underscore', 'ext/underscore.string', 'transcript',
'term', 'course', 'friend', 'util', 'user', 'user_course', 'prof',
'course_select'],
function($, _, _s, transcript, term, course, friend, util, user, uc, _prof,
course_select) {
  //console.log($, _, _s, transcript, term, course, friend, util, user, uc, _prof, course_selct);

  user.UserCollection.addToCache(pageData.userObjs);
  course.CourseCollection.addToCache(pageData.courseObjs);
  uc.UserCourses.addToCache(pageData.userCourseObjs);
  _prof.ProfCollection.addToCache(pageData.professorObjs);

  var profileUser = user.UserCollection.getFromCache(
    pageData.profileUserId.$oid);

  // TODO(sandy): remove, testing only
  var myOnSelectHandler = function(event) {
    console.log('yay i got picked');
    console.log(event);
    courseSelectView.clearSelection();
  }

  var courseSelectModel = new course_select.CourseSelect({
    placeholderText: 'Show these words instead',
    onSelectHandler: myOnSelectHandler
  });

  var courseSelectView = new course_select.CourseSelectView({
    model: courseSelectModel
  });

  var rendered = courseSelectView.render().el;
  $('#course-select-container').html(rendered);

  // Render friend sidebar
  (function() {
    var friendIds = profileUser.get('friend_ids');
    var friendObjs = [];
    _.each(friendIds, function(friendId) {
      var friendObj = user.UserCollection.getFromCache(friendId);
      friendObjs.push(friendObj);
    });
    var userCollection = new user.UserCollection(friendObjs);
    var friendSidebarView = new friend.FriendSidebarView({
      friendCollection: userCollection
    });
    $('#friend-sidebar-container').html(friendSidebarView.render().el);
  })();

  var renderTranscript = function(transcriptObj) {
    var termCollection = new term.TermCollection();

    _.each(transcriptObj, function(termObj) {
      var termModel = new term.TermModel(termObj);
      termCollection.add(termModel);
    });

    // Add the parsed term and course info to the page for live preview
    var termCollectionView = new term.TermCollectionView({
      termCollection: termCollection
    });
    $('#term-collection-container').html(termCollectionView.render().el).show();

    transcript_remove_text = $('#transcript-remove-text')
      .html('<a id="remove-transcript-link">Remove my course history, ratings and reviews!</a>')
      .show();
    $('#remove-transcript-link').click(function(event) {
      event.preventDefault();
      // TODO(Sandy): Ask for confirmation?

      $.post('/api/remove_transcript', {}, function(response) {
        // TODO(Sandy: Make duration dependent on the # of courses the user has
        duration = 1500;
        term_collection_container = $('#term-collection-container')
          .fancySlide('up', duration);
        transcript_remove_text.fadeOut(duration);

        setTimeout(function() {
          term_collection_container.html('');
          transcript_remove_text.html('');
        }, duration);
      });
    });
  }

  // Render the transcript, if available
  var transcriptObj = window.pageData.transcriptObj;
  if (transcriptObj && transcriptObj.length != 0) {
    renderTranscript(transcriptObj);
  }

  var $transcript = $('#transcript-text');

  $transcript.bind('input paste', function(evt) {
    // Remove any old info from the page
    $('#terms').empty();
    $('#transcript-error').empty();

    // Store the transcript text
    var data = $(evt.currentTarget).val();
    if (!data) {
      // If the text area has been emptied, exit immediately w/o
      // showing error message for parse failure.
      return;
    }

    addTranscriptData(data);
  });

  var addTranscriptData = function(data) {
    // Try/catch around parsing logic so that we show error message
    // should anything go wrong
    var transcriptData;
    var coursesByTerm;
    try {
      transcriptData = transcript.parseTranscript(data);
      coursesByTerm = transcriptData.coursesByTerm;
    } catch (ex) {
      console.warn('Could not parse transcript', ex);
      $('#transcript-error').text(
          'Uh oh. Could not parse your transcript :( ' +
          'Please check that you\'ve pasted your transcript correctly.');
      return;
    }

    // TODO(mack): fix confusing names between term/termObj and course/courseObj
    var courseIds = [];
    _.each(coursesByTerm, function(termObj) {
      _.each(termObj.courseIds, function(courseId) {
        courseIds.push(courseId);
      });
    });

    $.post(
      '/api/transcript',
      {
        'transcriptData': JSON.stringify(transcriptData)
      },
      function() {
        // TODO(mack): load and update page with js rather than reloading
        window.location.reload();
      },
      'json'
    );
  };

  // Handle the case that the user inputs into the transcript text area
  // before the page has finished loading.
  if ($transcript.val()) {
    $transcript.trigger('input');
  }

  var init = function() {
    if (util.getQueryParam('test')) {
      $.get('/static/sample_transcript.txt', function(data) {
        addTranscriptData(data);
      });
    }
  };

  init();
});
