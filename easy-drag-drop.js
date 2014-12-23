/* 
 * The drag and drop plugin is created completely using angular js.
 * There is no dependecy of Jquery
 * It is supported in touch devices
 * The plugin uses the basic functionalities from https://github.com/fatlinesofcode/ngDraggable
 * 
 *
 */

angular.module("easyDraggable", []);


angular.module("easyDraggable").factory('easyDraggableUtils', [function(){
	var svc = {
		newUuid: function() {
			function _p8(s) {
			var p = (Math.random().toString(16)+"000000000").substr(2,8);
				return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;
			}
			return _p8() + _p8(true) + _p8(true) + _p8();
		},

		emptyUuid: function() {
			return '00000000-0000-0000-0000-000000000000';
		},

		getOffset: function(element) {
			return element.getBoundingClientRect();
		},

		outerWidth: function(element) {
			return element.offsetWidth;
		},

		outerHeight: function(element) {
			return element.offsetHeight;
		},

		scrollTop: function() {
			return (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
		},

		scrollLeft: function() {
			return (window.pageXOffset !== undefined) ? window.pageXOffset : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
		},

		/**
		 * Method returns current page scroll values as array (X and Y axis).
		 * @return {Array} Returns array with two values [ scrollX, scrollY ].
		 * @public
		 * @function
		 * @name REDIPS.drag#getScrollPosition
		 */
		getScrollPosition: function () {
			// define local scroll position variables
			var scrollX, scrollY;
			// Netscape compliant
			if (typeof(window.pageYOffset) === 'number') {
				scrollX = window.pageXOffset;
				scrollY = window.pageYOffset;
			}
			// DOM compliant
			else if (document.body && (document.body.scrollLeft || document.body.scrollTop)) {
				scrollX = document.body.scrollLeft;
				scrollY = document.body.scrollTop;
			}
			// IE6 standards compliant mode
			else if (document.documentElement && (document.documentElement.scrollLeft || document.documentElement.scrollTop)) {
				scrollX = document.documentElement.scrollLeft;
				scrollY = document.documentElement.scrollTop;
			}
			// needed for IE6 (when vertical scroll bar was on the top)
			else {
				scrollX = scrollY = 0;
			}
			// return scroll positions
			return [ scrollX, scrollY ];
		}

	};

	return svc;    		
}]);

angular.module("easyDraggable").directive('easyDraggable', ['$rootScope', '$parse', 'easyDraggableUtils', function ($rootScope, $parse, easyDraggableUtils) {
	return {
		restrict: 'A',
		link: function (scope, element, attrs) {
			scope.value = attrs.easyDraggable;
			var clone = 'true';
			var revert = true;

			var offset, 
				_centerAnchor=false, 
				_mx, _my, 
				_tx, _ty,
				_cx, _cy, 
				_mrx, _mry, 
				scrollOffset, 
				midScrollY, 
				maxScrollY;

			var _hasTouch = ('ontouchstart' in document.documentElement);
			var _pressEvents = 'touchstart mousedown';
			var _moveEvents = 'touchmove mousemove';
			var _releaseEvents = 'touchend mouseup';
			var clonedElement = null;

			var scroll = (attrs.scroll == 'true') ? true : false;
			var scrollElement = (attrs.scrollElement) ? attrs.scrollElement : undefined;

			var ngDocument = angular.element(document);
			element = angular.element(element);

			//Gets id of the element in the DOM
			var id = element.attr("id");

			//Sets ID for the element if ID doesn't exists
			if (!id) {
				id = easyDraggableUtils.newUuid()
				element.attr("id", id);
			}

			var dragElement = null;

			var _data = null;

			var _dragEnabled = false;

			var _pressTimer = null;

			var onDragSuccessCallback = $parse(attrs.ngDragSuccess) || null;

			element.css({
				cursor: 'move'
			});

			var initialize = function () {
				element.attr('draggable', 'false'); // prevent native drag
				toggleListeners(true);
			};

			var toggleListeners = function (enable) {

				// remove listeners
				if (!enable)
					return;
				// add listeners.

				scope.$on('$destroy', onDestroy);
				//attrs.$observe("ngDrag", onEnableChange);
				scope.$watch(attrs.easyDraggable, onEnableChange);
				//attrs.$observe('ngCenterAnchor', onCenterAnchor);
				scope.$watch(attrs.ngCenterAnchor, onCenterAnchor);
				scope.$watch(attrs.ngDragData, onDragDataChange);
				element.on(_pressEvents, onLongPress);
				// if(! _hasTouch){
				// 	element.on('mousedown', function(){ return false;}); // prevent native drag
				// }
			};

			var onDestroy = function (enable) {
				toggleListeners(false);
			};

			var onDragDataChange = function (newVal, oldVal) {
				_data = newVal;
			};

			var onEnableChange = function (newVal, oldVal) {
				_dragEnabled = (newVal);
				if (typeof _dragEnabled === 'string') {
					_dragEnabled = ((_dragEnabled == 'true') ? true : false);
				}
			};

			var onCenterAnchor = function (newVal, oldVal) {
				if(angular.isDefined(newVal))
					_centerAnchor = (newVal || 'true');
			};

			/*
			* When the element is clicked start the drag behaviour
			* On touch devices as a small delay so as not to prevent native window scrolling
			*/
			var onPress = function(evt) {
				if(! _dragEnabled)
					return;

				if(_hasTouch){
					cancelPress();
					_pressTimer = setTimeout(function(){
						cancelPress();
						onLongPress(evt);

					}, 100);
					ngDocument.on(_moveEvents, cancelPress);
					ngDocument.on(_releaseEvents, cancelPress);
				}
				else {
					onLongPress(evt);
				}
			};

			var cancelPress = function() {
				clearTimeout(_pressTimer);
				ngDocument.off(_moveEvents, cancelPress);
				ngDocument.off(_releaseEvents, cancelPress);
			};

			var onLongPress = function(evt) {
				if(! _dragEnabled)
					return;
				
				evt.preventDefault();

				var windowTop = easyDraggableUtils.scrollTop();
				var windowLeft = easyDraggableUtils.scrollLeft();

				_mx = (evt.pageX || evt.changedTouches[0].pageX) - windowLeft;
				_my = (evt.pageY || evt.changedTouches[0].pageY) - windowTop;


				if(clone == 'true') {
					clonedElement = element.clone();
					element.parent().append(clonedElement);
					dragElement = clonedElement;
				}
				else {
					dragElement = element;
				}

				moveElement(_mx, _my);

				ngDocument.on(_moveEvents, onMove);
				ngDocument.on(_releaseEvents, onRelease);

				$rootScope.$broadcast('draggable:start', {
					x: _mx, y: _my, tx: _tx, ty: _ty, 
					element: element, 
					dragElement: dragElement,
					data: _data
				});

			};

			var onMove = function(evt) {
				if(! _dragEnabled)
					return;

				evt.preventDefault();


				_mx = (evt.pageX || evt.changedTouches[0].pageX);
				_my = (evt.pageY || evt.changedTouches[0].pageY);

				_cx = (evt.clientX || evt.changedTouches[0].clientX);
				_cy = (evt.clientY || evt.changedTouches[0].clientY);



				if(scroll) {
					var ua = navigator.userAgent,
                    boundary = (ua.match(/iPad/i)) ? 150 : 80;

					var dragOffset = easyDraggableUtils.getOffset(dragElement[0]);
					var dragHeight = easyDraggableUtils.outerHeight(dragElement[0]);

					var dragMarigin = [_cy - dragOffset.top, dragOffset.right - _cx, dragOffset.bottom - _cy, _cx - dragOffset.left];
					
					var scrollData = {};
					scrollData.width  = document.documentElement.scrollWidth;
					scrollData.height = document.documentElement.scrollHeight;

					if(scrollElement) {
						$scorllElemObj = angular.element(document.querySelector(scrollElement));                        
                        if (typeof scrollOffset !== 'object') {
	                        scrollOffset = easyDraggableUtils.getOffset($scorllElemObj[0]);
	                        midScrollY = (scrollOffset.top + scrollOffset.bottom) / 2;
	    					maxScrollY = $scorllElemObj[0].scrollHeight - $scorllElemObj[0].clientHeight;
                        }

						if(_mx < scrollOffset.right && _mx > scrollOffset.left && _my < scrollOffset.bottom && _my > scrollOffset.top) {							

							var edgeCrossed = boundary - (midScrollY > _my ? _my - dragMarigin[0] - scrollOffset.top : scrollOffset.bottom - _my - dragMarigin[2] - dragHeight);

							if (edgeCrossed > 0) {

								if (edgeCrossed > boundary) {
									edgeCrossed = boundary;
								}

								edgeCrossed *= _my < midScrollY ? -1 : 1;

								var scrollPosition = $scorllElemObj[0].scrollTop;
								if((edgeCrossed < 0 && scrollPosition > 0) || (edgeCrossed > 0 && scrollPosition < maxScrollY)) {
									$scorllElemObj[0].scrollTop = scrollPosition + edgeCrossed;
								}
							}	
							else {
								edgeCrossed = 0;
							}	
						}
					}
					else {

						if (Math.abs(window.orientation) === 90) { 
							screenHeight = screen.width;
						}
						else {
							screenHeight = screen.height;
						}

						boundary += 30;
						var edgeCrossed = boundary - (screenHeight / 2 > _cy ? _cy - dragMarigin[0] - dragHeight : screenHeight - _cy - dragMarigin[2] - dragHeight);
						if (edgeCrossed > 0) {
							if (edgeCrossed > boundary) {
								edgeCrossed = boundary;
							}
							// get vertical window scroll position
							scrollPosition = easyDraggableUtils.getScrollPosition()[1];
							// set scroll direction
							edgeCrossed *= _cy < screenHeight / 2 ? -1 : 1;
							// if page bound is crossed and this two cases aren't met:
							// 1) scrollbar is on the page top and user wants to scroll up
							// 2) scrollbar is on the page bottom and user wants to scroll down
							if (!((edgeCrossed < 0 && scrollPosition <= 0) || (edgeCrossed > 0 && scrollPosition >= (scrollData.height - screenHeight)))) {
								window.scrollBy(0, edgeCrossed);
							}
						} 
						else {
							edgeCrossed = 0;
						}

					}
				}

				var windowTop = easyDraggableUtils.scrollTop();
				var windowLeft = easyDraggableUtils.scrollLeft();

				_mx -= windowLeft;
				_my -= windowTop;
				
				moveElement(_mx, _my);

				$rootScope.$broadcast('draggable:move', {
					x: _mx, y: _my, tx: _tx, ty: _ty, 
					element: element, 
					dragElement: dragElement,
					data: _data
				});

			};

			var onRelease = function(evt) {

				if(! _dragEnabled)
					return;

				evt.preventDefault();

				$rootScope.$broadcast('draggable:end', {
					x: _mx, y: _my, tx: _tx, ty: _ty, 
					element: element,
					dragElement: dragElement, 
					data: _data, 
					callback:onDragComplete
				});

				resetElement();

				ngDocument.off(_moveEvents, onMove);
				ngDocument.off(_releaseEvents, onRelease);

			};

			var onDragComplete = function(evt) {

				if(!onDragSuccessCallback)
					return;

				scope.$apply(function () {
					onDragSuccessCallback(scope, {$data: _data, $event: evt});
				});
			};

			var resetElement = function() {
				var moveElement;

				if(clone == 'true') {
					moveElement = clonedElement;
					clonedElement.remove();
				}
				else {
					moveElement = element;
					element.removeClass('easy-dragging');
				}

				moveElement.css({
					'left': '',
					'top': '', 
					'position': '', 
					'z-index': '', 
					'margin': ''
				});

			};

			var moveElement = function(x,y) {
				var moveElement;

				if(clone == 'true') {
					clonedElement.addClass('easy-dragging');
					moveElement = clonedElement;
				}
				else {
					element.addClass('easy-dragging');
					moveElement = element;
				}

				moveElement.css({
					'left': x + 'px',
					'top': y + 'px', 
					'position': 'fixed', 
					'z-index': 99999, 
					'margin': '0'
				});
			};

			initialize();
		}
	}
}]);

angular.module("easyDraggable").directive('easyDroppable', ['$parse', '$timeout', 'easyDraggableUtils', function ($parse, $timeout, easyDraggableUtils) {
	return {
		restrict: 'A',
		link: function (scope, element, attrs) {
			scope.value = attrs.easyDroppable;

			var onDropAction = (typeof attrs.onDropAction !== 'undefined') ? attrs.onDropAction : 'touch';

			var _dropEnabled=false;

			var onDropSuccess = $parse(attrs.onDropSuccess) || null;// || function(){};

			var id = element.attr("id");
			if (!id) {
				id = easyDraggableUtils.newUuid()
				element.attr("id", id);
			}

			element.addClass('easy-droppable');

			var initialize = function () {
				toggleListeners(true);
			};

			var toggleListeners = function (enable) {
				// remove listeners

				if (!enable)
					return;
				// add listeners.
				scope.$watch(attrs.easyDroppable, onEnableChange);
				scope.$on('$destroy', onDestroy);

				scope.$on('draggable:start', onDragStart);
				scope.$on('draggable:move', onDragMove);
				scope.$on('draggable:end', onDragEnd);
			};

			var onDestroy = function (enable) {
				toggleListeners(false);
			};

			var onEnableChange = function (newVal, oldVal) {
				_dropEnabled = (newVal);
				if (typeof _dropEnabled === 'string') {
					_dropEnabled = ((_dropEnabled == 'true') ? true : false);
				}
			};

			var onDragStart = function(evt, dragObj) {
				if(! _dropEnabled || (element.attr('easy-droppable') === 'false'))
					return;
				isTouching(dragObj);
			};

			var onDragMove = function(evt, dragObj) {
				if(! _dropEnabled || (element.attr('easy-droppable') === 'false'))
					return;
				isTouching(dragObj);
			};

			var onDragEnd = function(evt, dragObj) {
				if(! _dropEnabled || (element.attr('easy-droppable') === 'false'))
					return;

				if(isTouching(dragObj)) {
					// call the ngDraggable element callback
					if(dragObj.callback){
						dragObj.callback(evt);
					}

					var data = {
						name: 'success',
						dropEl: element.attr('id'),
						dragEl: dragObj.element.attr('id')
					};

					scope.$apply(function (scope) {
						onDropSuccess(scope, {data: data});
					});


				}
				updateDragStyles(false, dragObj.element);
			};

			var isTouching = function(dragObj) {
				var touching= hitTest(dragObj);
				updateDragStyles(touching, dragObj.element);
				return touching;
			};

			//Updates classes in the DOM
			var updateDragStyles = function(touching, dragElement) {
				if(touching) {
					element.addClass('easy-drag-enter');
					dragElement.addClass('easy-drag-over');
				}
				else {
					element.removeClass('easy-drag-enter');
					dragElement.removeClass('easy-drag-over');
				}
			};

			//Returns true when the dragged element satisfies the drop condition
			var hitTest = function(dragObj) {
				var isHitted;

				var dragOffset = easyDraggableUtils.getOffset(dragObj.dragElement[0]); //Drag position
				var dropOffset = easyDraggableUtils.getOffset(element[0]); // Drop position

				var drW = easyDraggableUtils.outerWidth(dragObj.element[0]); // Drag width
				var drH = easyDraggableUtils.outerHeight(dragObj.element[0]); // Drag Height

				var drL = dragOffset.left, // Drag left
					drR = dragOffset.right, // Drag right
					drT = dragOffset.top, // Drag top
					drB = dragOffset.bottom, // Drag bottom

					dpL = dropOffset.left, // Drop left
					dpR = dropOffset.right, // Drop right
					dpT = dropOffset.top, // Drop top
					dpB = dropOffset.bottom; // Drop bottom

				switch(onDropAction) {

					//When the dragged element exactly fits to the droppable element
					case 'fit':
						isHitted = ( dpL <= drL && drR <= dpR && dpT <= drT && drB <= dpB );
						break;

					//When the dragged element intersects the droppable element half of its width
					case 'intersect':

						isHitted = dpL < drL + (drW / 2) && // Right Half
						drR - (drW / 2) < dpR && // Left Half
						dpT < drT + (drH / 2) && // Bottom Half
						drB - (drH / 2) < dpB; // Top Half

						break;

					//When the pointer enters to the droppable element
					case 'pointer':

						isHitted = dragObj.x >= dpL &&
						dragObj.x <= dpR &&
						dragObj.y <= dpB &&
						dragObj.y >= dpT;

						break;

					//When the dragged element touches the droppable element
					case 'touch':

						isHitted = (
						( drT >= dpT && drT <= dpB ) || // Top edge touching
						( drB >= dpT && drB <= dpB ) || // Bottom edge touching
						( drT < dpT && drB > dpB ) // Surrounded vertically
						) && (
						( drL >= dpL && drL <= dpR ) || // Left edge touching
						( drR >= dpL && drR <= dpR ) || // Right edge touching
						( drL < dpL && drR > dpR ) // Surrounded horizontally
						);  

						break;

					default:
						isHitted = false;

				}

				return isHitted;
			};

			initialize();
		}
	}
}]);