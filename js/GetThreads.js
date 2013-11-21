window.addEvent('domready', domReady);

/**
 * To be executed once the dom is ready; sets up the repeated checks to the server, to update and remove posts and threads as necessary.
 */
function domReady() {"use strict";
	$('newThread').addEvent('submit', addThread);

	var threadReq = new Request.JSON({
		url : 'control.php?action=getThreadList',
		onSuccess : readThreadSuccess
	});

	var repeater = function() {
		threadReq.send();
	};
	repeater();
	//call this once on load, so we don't have to wait for the time to elapse on page load before threads are shown
	repeater.periodical(5000);
	//5 seconds, for testing purposes. In a deployed scenario this should be higher so as to not stress the database too much
}

/**
 * Calls a manual update to the threads and posts, overriding the periodical checks.
 */
function manualUpdate() {"use strict";
	var threadReq = new Request.JSON({
		url : 'control.php?action=getThreadList',
		onSuccess : readThreadSuccess
	}).send();
}

/**
 * To be called once the threads have been retrieved from the server successfully. Checks the threads received as an array against the ones currently on the page, and then updates accordingly. Also starts the post checking process by calling readPostSuccess.
 * @param Array jArray The posts received from the server
 */
function readThreadSuccess(jArray) {"use strict";
	var currentThreads = $$('.threadItem');
	//getting the threads currently on the page
	var threadCount = currentThreads.length;
	if(currentThreads.length < jArray.length) {//we want the highest count of threads, from either server or page, so that we can iterate through all possibiities
		threadCount = jArray.length;
		//so if this is higher than the previously set, change it accordingly
	}

	for(var i = 0; i < threadCount; i++) {
		var threadID;
		if(jArray[i] === undefined) {
			threadID = currentThreads[i].id.split('-')[1];
		} else {
			threadID = jArray[i].id;
		}

		var postsReq = new Request.JSON({//assigning this here, since otherwise it has to be defined twice
			url : 'control.php?action=getThread&id=' + threadID,
			onSuccess : readPostsSuccess
		})

		if(currentThreads[i] === undefined) {//page says that the thread isn't there, so we insert it
			var threadObject = new ThreadItem(jArray[i].id, jArray[i].name);
			threadObject.display().inject($('threadList'));
			postsReq.send();
		} else if(jArray[i] === undefined) {//server says the thread on page isn't there, so delete it from the page
			removeDiv(currentThreads[i].id);
		} else if('thread-' + jArray[i].id === currentThreads[i].id) {//threads are the same so check if posts are
			postsReq.send();
		} else {//threads are not the same, so we need to resolve the conflict

			var contains;
			for(var j = 0; j < jArray.length; j++) {//check if the thread on page is in the jArray
				if(currentThreads[i].id === 'thread-' + jArray[j].id) {

					var threadObject = new ThreadItem(jArray[i].id, jArray[i].name);
					//if it is, we only need to insert it at the top, since that's the order that the threads go in
					threadObject.display().inject($('threadList'), 'top');
					postsReq.send();

					contains = true;
				};
			}

			if(!contains) {//otherwise it's no longer on the server, so remove it
				removeDiv(currentThreads[i].id);
			}

			i = threadCount;
			//exit the loop, so we can pick up any more on the next pass through. If we do it on this pass things are buggy, since we're waiting on things to be removed
		}
	}
}

/**
 * Checks the posts to see if any have been deleted or inserted, and if so, calls the functions to update them accordingly.
 * @param Array serverThread The thread as represented on the server
 * @param Array pageThread The thread as represented on the page
 */
function checkPosts(serverThread, pageThread) {"use strict";
	var threadID = serverThread[0].thread;
	var slideDiv = $('slider-' + threadID);

	var threadCount = pageThread.length;

	if(pageThread.length < serverThread.length) {//we want the highest count of threads, from either server or page, so that we can iterate through all possibiities
		threadCount = serverThread.length;
	}

	for(var i = 0; i < threadCount; i++) {
		if(pageThread[i] === undefined) {//page says that the post isn't there, so we insert it
			var postObject = new PostItem(serverThread[i].id, serverThread[i].name, serverThread[i].comment, serverThread[i].thread, serverThread[i].date);
			var postDiv = postObject.display();
			postDiv.inject(slideDiv);
			fadeIn(postDiv);
		} else if(serverThread[i] === undefined) {//server says the post on page isn't there, so delete it from the page
			removeDiv(pageThread[i].id);
		} else if('post-' + serverThread[i].id !== pageThread[i].id) {//posts are not the same. Remove from page since the server is always correct, then get the new page based array
			removeDiv(pageThread[i].id);
			i = threadCount;
			//exit the loop, so we can pick up any more on the next pass through. If we do it on this pass things are buggy.
		}
		//if we get here, the posts are the same, so we do nothing
	}
}

/**
 * Sets up the variables needed for checking posts, and also checks for if it's the first time running. If so, it performs the tasks required as needed.
 * @param jArray The posts as retrieved from the server
 */
function readPostsSuccess(jArray) {"use strict";
	var threadID = jArray[0].thread;

	//getting the ID of the thread from the first post located on the server
	var threadItem = $('thread-' + threadID);
	//getting the thread from the ID
	var slideDiv = $('slider-' + threadID);
	//getting the slider of that thread, so we can get the posts from it

	var currentPosts = [];
	//children is a nodelist and not an array, so we have to do this to transform to an array, as well as remove the first node, since it's the reply box
	if(slideDiv !== null && slideDiv.children.length > 1) {//if there is only one entry, then there are no actual posts yet, so we can't do anything

		for(var i = 1; i < slideDiv.children.length; i++) {
			currentPosts[i - 1] = slideDiv.children[i];
		}
		//remove the reply box, since it's not a post
	} else {
		//first time displaying the thread, so we do all the stuff required for first display
		setupThreadHeading(threadID, ' Author: ' + jArray[0].name + ' ' + jArray[0].date + ' ' + jArray.length + ' posts');
		fadeIn(threadItem);
	}
	checkPosts(jArray, currentPosts);
}

/**
 * Sets up the heading of a thread to use a slider, and aslo sets the text denoting the author, time of creation, etc.
 * @param int threadID The ID of the thread to setup and add a header to
 * @param String headerString The message to display as the heading on the thread
 */
function setupThreadHeading(threadID, headerString) {"use strict";

	var threadHeader = $('threadHeader' + threadID);
	//get the header div using the threadID provided
	var sliderDiv = 'slider-' + threadID;
	var slider = new Fx.Slide(sliderDiv, {//setting up the slide effect to open and close threads
		duration : 1000,
		resetHeight : true, //note that this is not true by default, and without it the desired effect breaks horribly
		transition : Fx.Transitions.Pow.easeOut
	}).hide();
	threadHeader.addEvent('click', function(e) {//add the event to the threadheader, so that the main thread heading can all be clicked to expand/contract the thread
		slider.toggle();
	});

	var threadStats = new Element('h4', {//creating and injecting the stats of the thread such as the author, date etc
		'id' : 'threadStats-' + threadID,
		html : ' Author: ' + headerString
	});

	threadStats.inject(threadHeader);
}

/**
 * Performs the action of adding a thread to the database to be reflected when the page is next updated. Also performs some simple validation
 */
function addThread(e) {
	e.stop();

	var form = $('newThread');

	var threadReq = new Request({
		url : 'control.php?action=createThread',
		onSuccess : threadSuccess
	});

	//validation start
	var valid = true;
	if(form.title.value == "" || form.title.value.length > 255) {
		form.title.addClass('error');
		valid = false;
	}

	if(form.comment.value == "") {
		form.comment.addClass('error');
		valid = false;
	}

	if(form.password.value == "" || form.password.value.length > 255) {
		form.password.addClass('error');
		valid = false;
	}
	if(!valid) {
		return;
	}
	//validation end

	var form = $('newThread');
	var threadAsString = "name=" + form.title.value;
	threadReq.post(threadAsString);

}

/**
 * To be called when the thread has been successfully sent to the server. Inserts the first post, which should always be made with the thread
 */
function threadSuccess(idNo) {
	var postReq = new Request({
		url : 'control.php?action=insertPost',
		onSuccess : manualUpdate
	});

	var form = $('newThread');

	var title = form.title.value;
	var name = form.name.value;
	var comment = form.comment.value;
	var password = form.password.value;

	if(name == '') {
		name = 'Anonymous'
	}

	var postAsString = "name=" + name + "&comment=" + comment + "&thread=" + idNo + "&password=" + password;
	postReq.post(postAsString);
	form.comment.value = '';
	form.name.value = '';
	form.password.value = '';
	form.title.value = '';
}

/**
 * Removes a div by fading it using a tween so the user can no longer see it, then destroying it to remove it from the dom.
 * @param String id The id of the div to remove
 */
function removeDiv(id) {"use strict";
	var divToRemove = $(id);
	//getting the div to remove from the id provided
	var fadeEffect = new Fx.Tween(divToRemove, {
		property : 'opacity',
		duration : 'long'
	});
	fadeEffect.start(0.8, 0);
	function remove() {//we define this here, since only a function pointer can be used in setTimeout
		divToRemove.destroy();
	}

	setTimeout(remove, 2000);
	//we want the animation to finish before we destroy the div, otherwise the user will never see the animation
}

/**
 * Fades in a Div such as a thread or post, giving it a nice animation to show that it has arrived
 * @param Element divToFade The div to fade in to view
 */
function fadeIn(divToFade) {"use strict";
	divToFade.style.opacity = 0;
	//making sure the div is invisible so we can actually fade it in. This should be set already in the css, but is here just in case it is not
	var fadeEffect = new Fx.Tween(divToFade, {//setting up the transition
		property : 'opacity',
		duration : 'long'
	});
	fadeEffect.start(0, 0.8);
	//and finally running the transition
}

/**
 * Adds a comment to the database, which should then be reflected on the page when the page is next updated.
 */
function addComment(e) {"use strict";
	e.stop();

	var postReq = new Request({
		url : 'control.php?action=insertPost',
		onSuccess : manualUpdate
	});
	var form = $(this.id);
	var name = form.name.value;
	//validation start
	var valid = true;
	//only simple validation checking for empty fields and some field lengths, since we're not checking phone numbers etc
	if(form.comment.value === "") {
		form.comment.addClass('error');
		valid = false;
	}
	if(form.password.value === "" || form.password.value.length > 255) {
		form.password.addClass('error');
		valid = false;
	}
	if(form.name.value.length > 255) {
		form.name.addClass('error');
		valid = false;
	} else if(form.name.value.length === 0) {
		name = 'Anonymous';
	}
	if(!valid) {//if invalid, we don't want to do anything else since the data retrieved is of no use to us, so return
		return;
	}
	//validation end

	var threadID = (this.id + '').split('-');
	//getting the thread id by splitting the id of this
	var postAsString = "name=" + name + "&comment=" + form.comment.value + "&thread=" + threadID[1] + "&password=" + form.password.value;
	//the post we want to make, represented as a string ready to send
	postReq.post(postAsString);
	//sending the string
	form.comment.value = '';
	form.name.value = '';
	form.password.value = '';
	//cleaning up
}

/**
 * Styles the div given by adding effects to trigger on the user hovering over the div
 * @param Element postDiv The div to add the effects to
 */
function addHoverEffects(postDiv) {"use strict";

	postDiv.set('morph', {//setting up the transition
		duration : 400
	});

	postDiv.addEvents({//then adding the required events with styling
		mouseenter : function() {
			postDiv.morph({
				'background-color' : '#EEEEFE'
			});
		},

		mouseleave : function() {
			postDiv.morph({
				'background-color' : '#FFFFFF'
			});
		}
	});
}

/**
 * Deletes a thread and all its posts from the server. The user will have needed to input the correct password that they chose when creating the thread.
 */
function deleteThread(e) {"use strict";
	e.stop();
	var id = this.id.split('-');
	var slideDiv = $('slider-' + id[1]);
	var postsToDelete = [];
	var passField = $('threadPasswordInput-' + id[1]);
	var passCorrect;
	var firstPostID = slideDiv.children[1].id.split('-')[1];

	var singlePostReq = new Request.JSON({
		url : 'control.php?action=getSinglePost&id=' + firstPostID,
		onSuccess : success
	}).send();

	function success(post) {"use strict";
		if(post.password === passField.value) {
			passCorrect = true;
		} else {
			passCorrect = false;
		}
	}

	wait();

	function wait() {"use strict";
		if(passCorrect === undefined) {
			setTimeout(wait, 50);
			return;
		} else {
			gotPass();
		}
	}

	function gotPass() {"use strict";
		if(passCorrect === false) {
			passField.addClass('error');
			return;
		}

		for(var i = 1; i < slideDiv.children.length; i++) {
			postsToDelete[i - 1] = slideDiv.children[i];
		}

		for(var j = 0; j < postsToDelete.length; j++) {//deleting the posts from the thread
			var postID = postsToDelete[j].id.split('-');
			var postDeleteReq = new Request.JSON({
				url : 'control.php?action=removePost&id=' + postID[1],
				onSuccess : manualUpdate
			}).send();
		}

		var deleteReq = new Request.JSON({
			url : 'control.php?action=deleteThread&id=' + id[1],
			onSuccess : manualUpdate
		}).send();
	}

}

/**
 * Deletes a post from a thread. Note that if this is the first post in a thread, it also deletes the thread.
 */
function deletePost(e) {"use strict";
	e.stop();
	var id = this.id.split('-');
	var post = $('post-' + id[1]);
	var slideDiv = post.parentNode;
	var threadID = slideDiv.id.split('-')[1];
	var passField = $('postPasswordInput-' + id[1]);
	var passCorrect;

	var singlePostReq = new Request.JSON({
		url : 'control.php?action=getSinglePost&id=' + id[1],
		onSuccess : success
	}).send();

	function success(post) {"use strict";
		if(post.password === passField.value) {
			passCorrect = true;
		} else {
			passCorrect = false;
		}
	}

	wait();

	function wait() {"use strict";
		if(passCorrect === undefined) {
			setTimeout(wait, 50);
			return;
		} else {
			gotPass();
		}
	}

	function gotPass() {"use strict";
		if(passCorrect === false) {
			passField.addClass('error');
			return;
		}
		if(slideDiv.children[1] === post) {

			var postsToDelete = [];

			for(var i = 1; i < slideDiv.children.length; i++) {
				postsToDelete[i - 1] = slideDiv.children[i];
			}

			for(var j = 0; j < postsToDelete.length; j++) {//deleting the posts from the thread
				var postID = postsToDelete[j].id.split('-');
				var postDeleteReq = new Request.JSON({
					url : 'control.php?action=removePost&id=' + postID[1],
					onSuccess : manualUpdate
				}).send();
			}

			var deleteThreadReq = new Request.JSON({
				url : 'control.php?action=deleteThread&id=' + threadID,
				onSuccess : manualUpdate
			}).send();
			console.log(deleteThreadReq);
		} else {
			var deleteReq = new Request.JSON({
				url : 'control.php?action=removePost&id=' + id[1],
				onSuccess : manualUpdate
			}).send();
			console.log(deleteReq);
		}
	}

}

/**
 * Edits a thread, using the supplied values. The user will have needed to input the correct password that they chose when creating the thread.
 */
function editThread(e) {"use strict";
	e.stop();
	var id = this.id.split('-')[1];
	var editForm = $('editForm-' + id);
	var editAsString = "&id=" + id + "&name=" + editForm.title.value;
	var firstPost = $("slider-"+id).children[1];
	var postID = firstPost.id.split('-')[1];
	var postEditAsString = "&id=" + postID + "&name=" + editForm.name.value + "&comment=" + editForm.comment.value;
	var passField = editForm.password;
	var passCorrect;

	var singlePostReq = new Request.JSON({//getting the password
		url : 'control.php?action=getSinglePost&id=' + postID,
		onSuccess : success
	}).send();

	function success(post) {"use strict";//we got the first post, so we can check the password
		if(post.password === passField.value) {
			passCorrect = true;
		} else {
			passCorrect = false;
		}
	}

	wait();

	function wait() {"use strict";
		if(passCorrect === undefined) {
			setTimeout(wait, 50);
			return;
		} else {
			gotPass();
		}
	}

	function gotPass() {"use strict";
		if(passCorrect === false) {
			passField.addClass('error');
			return;
		}
		var editReq = new Request.JSON({
			url : 'control.php?action=renameThread',
		}).send(editAsString);

		var editPostReq = new Request.JSON({
			url : 'control.php?action=editPost',
			onSuccess : editThreadSuccess
		}).send(editAsString);
	}

}

/**
 * Edits a post, using the supplied values.
 */
function editPost(e) {"use strict";
	e.stop();
	var id = this.id.split('-')[1];
	var editForm = $("editPostForm-" + id);
	var editAsString = "&id=" + id + "&name=" + editForm.name.value + "&comment=" + editForm.comment.value;
	var passField = editForm.password;
	var passCorrect;

	var singlePostReq = new Request.JSON({//getting the password
		url : 'control.php?action=getSinglePost&id=' + id,
		onSuccess : success
	}).send();

	function success(post) {"use strict";//we got the post from the server, so we can check the password
		if(post.password === passField.value) {
			passCorrect = true;
		} else {
			passCorrect = false;
		}
	}

	wait();

	function wait() {"use strict";
		if(passCorrect === undefined) {
			setTimeout(wait, 50);
			return;
		} else {
			gotPass();
		}
	}

	function gotPass() {"use strict";
		if(passCorrect === false) {
			passField.addClass('error');
			return;
		}
		var editReq = new Request.JSON({
			url : 'control.php?action=editPost',
			onSuccess : editPostSuccess
		}).send(editAsString);
	}

}

/**
 * Showing the user that their post has been successful
 */
function postSuccess() {"use strict";
	manualUpdate();
}

/**
 * To be called once a thread has been deleted. Should manually update the page to let the user know that the delete has been completed
 */
function deleteThreadSuccess() {"use strict";
	manualUpdate();
}

/**
 * To be called once a post has been deleted. Should manually update the page to let the user know that the delete has been completed
 */
function deletePostSuccess() {"use strict";
	manualUpdate();
}

/**
 * To be called once a post has been edited. Should manually update the page to let the user know that the edit has been completed
 */
function editPostSuccess() {"use strict";
	$('threadList').empty();
	manualUpdate();
}

/**
 * ThreadItem Class
 * Class representing a thread on the page. Initializes and displays all the components required to show a thread
 */
var ThreadItem = new Class({

	initialize : function(id, name) {"use strict";
		this.id = id;
		this.name = name;
	},

	display : function() {"use strict";
		//main thread heading start
		var cont = new Element('div', {
			'class' : 'threadItem',
			'id' : 'thread-' + this.id
		});
		var headerCont = new Element('div', {
			'class' : 'threadHeader',
			'id' : 'threadHeader' + this.id
		});
		var title = new Element('h3', {
			'class' : 'threadTitle',
			'text' : this.name
		});
		//main thread heading end

		//thread sub heading start
		var threadSubHeading = new Element('div', {//replace me
			'id' : 'threadSubHeading-' + this.id
		});
		var threadControls = new Element('div', {
			'class' : 'control',
			'id' : 'threadControl' + this.id
		});
		var threadEditControl = new Element('a', {
			html : 'Edit thread ',
			'href' : 'javascript:void(0)',
			'class' : 'control'
		});
		var threadDeleteControl = new Element('a', {
			html : 'Delete thread',
			'class' : 'control',
			'href' : 'javascript:void(0)',
			'id' : 'threadDelete-' + this.id
		});
		threadEditControl.inject(threadControls);
		threadDeleteControl.inject(threadControls);
		//thread sub heading end

		//slider div so we can hide the thread body
		var slideDiv = new Element('div', {
			'class' : 'slideContainer',
			'id' : 'slider-' + this.id
		});

		//reply form start
		var replyForm = new Element('form', {
			'id' : 'threadForm-' + this.id,
			'class' : 'threadForm',
			'action' : '#'
		});
		var formHeaderDiv = new Element('div', {
			'class' : 'input'
		});
		var formHeader = new Element('h4', {
			html : 'Add a reply'
		});
		var nameDiv = new Element('div', {
			'class' : 'input'
		});
		var nameInput = new Element('input', {
			'type' : 'text',
			'name' : 'name',
			'class' : 'input',
			'placeholder' : 'Name'
		});
		var commentDiv = new Element('div', {
			'class' : 'input'
		});
		var commentInput = new Element('textarea', {
			'name' : 'comment',
			'placeholder' : 'Comment',
			'class' : 'input',
			'rows' : '5'
		});
		var passwordInputDiv = new Element('div', {
			'class' : 'input'
		});
		var passwordInput = new Element('input', {
			'name' : 'password',
			'placeholder' : 'Password',
			'class' : 'input'
		});
		var submitInput = new Element('input', {
			'type' : 'submit',
			'value' : 'Submit',
			'class' : 'input'
		});

		nameInput.inject(nameDiv);
		commentInput.inject(commentDiv);
		formHeader.inject(formHeaderDiv);
		formHeaderDiv.inject(replyForm);
		nameDiv.inject(replyForm);
		commentDiv.inject(replyForm);
		passwordInput.inject(passwordInputDiv);
		passwordInputDiv.inject(replyForm);
		submitInput.inject(replyForm);
		//reply form end

		//delete form start
		var deleteSliderDiv = new Element('div', {
			'id' : 'deleteSlider-' + this.id
		});
		var deleteForm = new Element('form', {
			'id' : 'deleteForm-' + this.id,
			'class' : 'deleteForm',
			'action' : '#'
		});
		var deleteFormLabel = new Element('label', {
			html : 'Password: '
		});
		var deleteFormInput = new Element('input', {
			'type' : 'text',
			'name' : 'password',
			'placeholder' : 'password',
			'id' : 'threadPasswordInput-' + this.id
		});
		var deleteFormSubmit = new Element('input', {
			'type' : 'submit',
			'value' : 'submit',
			'id' : 'deleteSubmit-' + this.id
		});
		deleteFormLabel.inject(deleteForm);
		deleteFormInput.inject(deleteForm);
		deleteFormSubmit.inject(deleteForm);
		deleteForm.inject(deleteSliderDiv);
		//delete form end

		//edit form start
		var editSlider = new Element('div', {
			'id' : 'editSlider-' + this.id
		});
		var editForm = new Element('form', {
			'id' : 'editForm-' + this.id,
			'class' : 'editForm',
			'action' : 'javascript:void(0)'
		});
		var editFormLabelDiv = new Element('div', {
			'class' : 'input'
		});
		var editFormLabel = new Element('h4', {
			html : 'Edit thread'
		});
		var editFormTitleDiv = new Element('div', {
			'class' : 'input'
		});
		var editFormTitle = new Element('input', {
			'id' : 'editFormTitle-' + this.id,
			'name' : 'title',
			'class' : 'input',
			'placeholder' : 'Title',
			'type' : 'text'
		});
		var editFormNameDiv = new Element('div', {
			'class' : 'input'
		});
		var editFormName = new Element('input', {
			'id' : 'editFormName-' + this.id,
			'class' : 'input',
			'placeholder' : 'Name',
			'type' : 'text',
			'name' : 'name'
		});
		var editFormCommentDiv = new Element('div', {
			'class' : 'input'
		});
		var editFormComment = new Element('textarea', {
			'id' : 'editFormComment-' + this.id,
			'name' : 'comment',
			'placeholder' : 'Comment',
			'class' : 'input',
			'rows' : '5'
		});
		var editFormPasswordDiv = new Element('div', {
			'class' : 'input'
		});
		var editFormPassword = new Element('input', {
			'id' : 'editThreadPassword-' + this.id,
			'class' : 'input',
			'placeholder' : 'Password',
			'type' : 'text',
			'name' : 'password'
		});
		var editFormSubmitDiv = new Element('div', {
			'class' : 'input'
		});
		var editFormSubmit = new Element('input', {
			'type' : 'submit',
			'class' : 'input',
			'value' : 'submit',
			'id' : 'editSubmit-' + this.id
		});
		editFormLabel.inject(editFormLabelDiv);
		editFormLabelDiv.inject(editForm);
		editFormTitle.inject(editFormTitleDiv);
		editFormTitleDiv.inject(editForm);
		editFormName.inject(editFormNameDiv);
		editFormNameDiv.inject(editForm);
		editFormComment.inject(editFormCommentDiv);
		editFormCommentDiv.inject(editForm);
		editFormPassword.inject(editFormPasswordDiv);
		editFormPasswordDiv.inject(editForm);
		editFormSubmit.inject(editFormSubmitDiv);
		editFormSubmitDiv.inject(editForm);
		editForm.inject(editSlider);
		//edit form end

		//injects start
		replyForm.inject(slideDiv);
		title.inject(headerCont);
		threadSubHeading.inject(headerCont);
		headerCont.inject(cont);
		threadControls.inject(cont);
		deleteSliderDiv.inject(cont);
		editSlider.inject(cont);
		slideDiv.inject(cont);
		//injects end

		replyForm.addEvent('submit', addComment);

		var deleteSlider = new Fx.Slide(deleteSliderDiv, {//creating sliders for the edit and delete controls
			duration : 1000,
			resetHeight : true,
			transition : Fx.Transitions.Pow.easeOut
		}).hide();
		threadDeleteControl.addEvent('click', function(e) {
			deleteSlider.toggle();
		});
		deleteFormSubmit.addEvent('click', deleteThread);

		var editSlider = new Fx.Slide(editSlider, {
			duration : 1000,
			resetHeight : true,
			transition : Fx.Transitions.Pow.easeOut
		}).hide();
		threadEditControl.addEvent('click', function(e) {
			editSlider.toggle();
		});
		editFormSubmit.addEvent('click', editThread);

		addHoverEffects(headerCont);

		return cont;
	}
});

/**
 * PostItem Class
 * Class representing a post in a thread on the page. Initializes and displays all the components required to show a post
 */
var PostItem = new Class({

	initialize : function(id, name, comment, thread, date) {"use strict";
		this.id = id;
		this.name = name;
		this.comment = comment;
		this.thread = thread;
		this.date = date;
	},

	display : function() {"use strict";
		var cont = new Element('div', {
			'class' : 'postItem',
			'id' : 'post-' + this.id
		});
		var title = new Element('p', {
			'class' : 'postTitle',
			'text' : this.date + ' ' + this.name
		});
		var comment = new Element('p', {
			'class' : 'postComment',
			'text' : this.comment
		});

		var postControls = new Element('div', {
			'class' : 'postControl',
			'id' : 'postControl' + this.id
		});
		var postEditControl = new Element('a', {
			html : 'Edit post ',
			'href' : 'javascript:void(0)',
			'class' : 'control'
		});
		var postDeleteControl = new Element('a', {
			html : 'Delete post',
			'href' : 'javascript:void(0)',
			'class' : 'control'
		});

		//edit form start
		var editPostSlider = new Element('div', {
			'id' : 'editPostSlider-' + this.id
		});
		var editPostForm = new Element('form', {
			'id' : 'editPostForm-' + this.id,
			'class' : 'editForm',
			'action' : '#'
		});
		var editPostFormLabelDiv = new Element('div', {
			'class' : 'input'
		});
		var editPostFormLabel = new Element('h4', {
			html : 'Edit post'
		});
		var editPostFormNameDiv = new Element('div', {
			'class' : 'input'
		});
		var editPostFormName = new Element('input', {
			'id' : 'editPostFormName-' + this.id,
			'class' : 'input',
			'placeholder' : 'Name',
			'type' : 'text',
			'name' : 'name'
		});
		var editPostFormCommentDiv = new Element('div', {
			'class' : 'input'
		});
		var editPostFormComment = new Element('textarea', {
			'id' : 'editPostFormComment-' + this.id,
			'name' : 'comment',
			'placeholder' : 'Comment',
			'class' : 'input',
			'rows' : '5'
		});
		var editPostFormPasswordDiv = new Element('div', {
			'class' : 'input'
		});
		var editPostFormPassword = new Element('input', {
			'id' : 'editPostPassword-' + this.id,
			'class' : 'input',
			'placeholder' : 'Password',
			'type' : 'text',
			'name' : 'password'
		});
		var editPostFormSubmitDiv = new Element('div', {
			'class' : 'input'
		});
		var editPostFormSubmit = new Element('input', {
			'type' : 'submit',
			'class' : 'input',
			'value' : 'submit',
			'id' : 'editPostSubmit-' + this.id
		});
		editPostFormLabel.inject(editPostFormLabelDiv);
		editPostFormLabelDiv.inject(editPostForm);
		editPostFormName.inject(editPostFormNameDiv);
		editPostFormNameDiv.inject(editPostForm);
		editPostFormComment.inject(editPostFormCommentDiv);
		editPostFormCommentDiv.inject(editPostForm);
		editPostFormPassword.inject(editPostFormPasswordDiv);
		editPostFormPasswordDiv.inject(editPostForm);
		editPostFormSubmit.inject(editPostFormSubmitDiv);
		editPostFormSubmitDiv.inject(editPostForm);
		editPostForm.inject(editPostSlider);
		//edit form end

		//delete form start
		var deletePostSlider = new Element('div', {
			'id' : 'deletePostSlider-' + this.id
		});
		var deletePostForm = new Element('form', {
			'id' : 'deletePostForm-' + this.id,
			'class' : 'deleteForm',
			'action' : '#'
		});
		var deletePostFormLabel = new Element('label', {
			html : 'Password: '
		});
		var deletePostFormInput = new Element('input', {
			'type' : 'text',
			'name' : 'password',
			'placeholder' : 'password',
			'id' : 'postPasswordInput-' + this.id
		});
		var deletePostFormSubmit = new Element('input', {
			'type' : 'submit',
			'value' : 'submit',
			'id' : 'deletePostSubmit-' + this.id
		});
		deletePostFormLabel.inject(deletePostForm);
		deletePostFormInput.inject(deletePostForm);
		deletePostFormSubmit.inject(deletePostForm);
		deletePostForm.inject(deletePostSlider);
		//delete form end

		postEditControl.inject(postControls);
		postDeleteControl.inject(postControls);

		title.inject(cont);
		postControls.inject(cont);
		editPostSlider.inject(cont);
		deletePostSlider.inject(cont);
		comment.inject(cont);

		var deletePostSlider = new Fx.Slide(deletePostSlider, {//setting up sliders for the edit and delete controls
			duration : 1000,
			resetHeight : true,
			transition : Fx.Transitions.Pow.easeOut
		}).hide();
		postDeleteControl.addEvent('click', function(e) {
			deletePostSlider.toggle();
		});
		deletePostFormSubmit.addEvent('click', deletePost);

		var editSlider = new Fx.Slide(editPostSlider, {
			duration : 1000,
			resetHeight : true,
			transition : Fx.Transitions.Pow.easeOut
		}).hide();
		postEditControl.addEvent('click', function(e) {
			editSlider.toggle();
		});
		editPostFormSubmit.addEvent('click', editPost);

		cont.setStyle('opacity', 0);
		//hide so that we can fade it in later
		addHoverEffects(cont);

		return cont;
	}
});
