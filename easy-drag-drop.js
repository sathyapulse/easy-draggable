/* 
 * The drag and drop plugin is created completely using angular js.
 * There is no dependecy of Jquery
 * It is supported in touch devices
 * The plugin uses the basic functionalities from https://github.com/fatlinesofcode/ngDraggable
 * 
 *
 */
angular.module("easyDraggable", []);


angular.module("easyDraggable").factory('easyDraggableUtils', [function() {
  var svc = {
    newUuid: function() {
      function _p8(s) {
        var p = (Math.random().toString(16) + "000000000").substr(2, 8);
        return s ? "-" + p.substr(0, 4) + "-" + p.substr(4, 4) : p;
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
    getScrollPosition: function() {
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
      return [scrollX, scrollY];
    }

  };

  return svc;
}]);

angular.module("easyDraggable").directive('easyDraggable', ['$rootScope', '$parse', 'easyDraggableUtils', '$timeout', function($rootScope, $parse, easyDraggableUtils, $timeout) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      scope.value = attrs.easyDraggable;
      var clone = 'true',
        revert = true,
        initialX = 0,
        initialY = 0,
        initialWidth = '',
        mRegisterX = 0,
        mRegisterY = 0;

      var offset,
        _centerAnchor = false,
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
      clone = (attrs.clone == 'false') ? 'false' : 'true';

      var scrollElement = (attrs.scrollElement) ? attrs.scrollElement : undefined;

      var ngDocument = angular.element(document);
      element = angular.element(element);

      //Gets id of the element in the DOM
      var id = element.attr("id");

      //Sets ID for the element if ID doesn't exists
      if (!id) {
        id = easyDraggableUtils.newUuid();
        element.attr("id", id);
      }

      var dragElement = null;

      var _data = null;

      var _dragEnabled = false;

      var _pressTimer = null;

      var onDragStartCallback = $parse(attrs.whenDragStart) || null;
      var onDragStopCallback = $parse(attrs.whenDragStop) || null;
      var onDragSuccessCallback = $parse(attrs.ngDragSuccess) || null;
      var onDragFailCallback = $parse(attrs.ngDragFail) || null;

      element.css({
        cursor: 'move'
      });

      var initialize = function() {
        element.attr('draggable', 'false'); // prevent native drag
        toggleListeners(true);
      };

      var toggleListeners = function(enable) {

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

      var onDestroy = function(enable) {
        toggleListeners(false);
      };

      var onDragDataChange = function(newVal, oldVal) {
        _data = newVal;
      };

      var onEnableChange = function(newVal, oldVal) {
        _dragEnabled = (newVal);
        if (typeof _dragEnabled === 'string') {
          _dragEnabled = ((_dragEnabled == 'true') ? true : false);
        }
      };

      var onCenterAnchor = function(newVal, oldVal) {
        if (angular.isDefined(newVal))
          _centerAnchor = (newVal || 'true');
      };

      /*
       * When the element is clicked start the drag behaviour
       * On touch devices as a small delay so as not to prevent native window scrolling
       */
      var onPress = function(evt) {

        if (!_dragEnabled)
          return;

        if (_hasTouch) {
          cancelPress();
          _pressTimer = setTimeout(function() {
            cancelPress();
            onLongPress(evt);

          }, 100);
          ngDocument.on(_moveEvents, cancelPress);
          ngDocument.on(_releaseEvents, cancelPress);
        } else {
          onLongPress(evt);
        }
      };

      var cancelPress = function() {
        clearTimeout(_pressTimer);
        ngDocument.off(_moveEvents, cancelPress);
        ngDocument.off(_releaseEvents, cancelPress);
      };

      var onLongPress = function(evt) {
        if (!_dragEnabled)
          return;

        evt.preventDefault();

        if (evt.touches && evt.touches.length > 1) {
          return;
        }

        _mx = (evt.pageX) ? evt.pageX : (evt.changedTouches) ? evt.changedTouches[0].pageX : evt.originalEvent.changedTouches[0].pageX;
        _my = (evt.pageY) ? evt.pageY : (evt.changedTouches) ? evt.changedTouches[0].pageY : evt.originalEvent.changedTouches[0].pageY;

        _cx = (evt.clientX) ? evt.clientX : (evt.changedTouches) ? evt.changedTouches[0].clientX : evt.originalEvent.changedTouches[0].pageX;
        _cy = (evt.clientY) ? evt.clientY : (evt.changedTouches) ? evt.changedTouches[0].clientY : evt.originalEvent.changedTouches[0].pageY;


        if (clone == 'true') {
          clonedElement = element.clone();
          element.parent().append(clonedElement);
          dragElement = clonedElement;
        } else {
          dragElement = element;
        }

        initialX = element[0].offsetLeft;
        initialY = element[0].offsetTop;
        initialWidth = element.css('width');


        var moveX = _cx - element[0].getBoundingClientRect().left;
        var moveY = _cy - element[0].getBoundingClientRect().top;

        mRegisterX = moveX;
        mRegisterY = moveY;

        moveX += element[0].offsetLeft;
        moveY += element[0].offsetTop;

        moveX -= mRegisterX;
        moveY -= mRegisterY;

        moveElement(moveX, moveY);

        var windowTop = easyDraggableUtils.scrollTop();
        var windowLeft = easyDraggableUtils.scrollLeft();

        _mx -= windowLeft;
        _my -= windowTop;

        ngDocument.on(_moveEvents, onMove);
        ngDocument.on(_releaseEvents, onRelease);

        //Class added to remove highlighting when start dragging
        //element.addClass('easy-drag-started');

        $rootScope.$broadcast('draggable:start', {
          x: _mx,
          y: _my,
          tx: _tx,
          ty: _ty,
          element: element,
          dragElement: dragElement,
          data: _data
        });
        evt.stopPropagation();

        if (onDragStartCallback) {
          var data = {
            name: 'started',
            dragEl: element.attr('id')
          };
          scope.$apply(function() {
            onDragStartCallback(scope, {
              data: data
            });
          });
        }
      };

      var onMove = function(evt) {
        if (!_dragEnabled)
          return;

        evt.preventDefault();


        _mx = (evt.pageX) ? evt.pageX : (evt.changedTouches) ? evt.changedTouches[0].pageX : evt.originalEvent.changedTouches[0].pageX;
        _my = (evt.pageY) ? evt.pageY : (evt.changedTouches) ? evt.changedTouches[0].pageY : evt.originalEvent.changedTouches[0].pageY;

        _cx = (evt.clientX) ? evt.clientX : (evt.changedTouches) ? evt.changedTouches[0].clientX : evt.originalEvent.changedTouches[0].pageX;
        _cy = (evt.clientY) ? evt.clientY : (evt.changedTouches) ? evt.changedTouches[0].clientY : evt.originalEvent.changedTouches[0].pageY;

        var ngScrollElement = angular.element(document.querySelector(scrollElement));

        var scrollLimit = ngScrollElement[0].scrollHeight - ngScrollElement[0].clientHeight;

        var scrollElementOffset = ngScrollElement[0].getBoundingClientRect();

        var scrollElementTop = scrollElementOffset.top;
        var scrollElementBottom = scrollElementOffset.bottom;
        var scrollElementLeft = scrollElementOffset.left;
        var scrollElementRight = scrollElementOffset.right;


        _cx = (scrollElementLeft > _cx) ? scrollElementLeft : _cx;
        _cx = (scrollElementRight < _cx) ? scrollElementRight : _cx;

        _cy = (scrollElementTop > _cy) ? scrollElementTop : _cy;
        _cy = (scrollElementBottom < _cy) ? scrollElementBottom : _cy;


        if (scroll && scrollElement) {


          var dragElementBottom = dragElement[0].getBoundingClientRect().bottom;
          var dragElementTop = dragElement[0].getBoundingClientRect().top;

          if (dragElementBottom > scrollElementBottom) {
            var scrollPosition = dragElementBottom - scrollElementBottom;

            scrollPosition = ngScrollElement[0].scrollTop + scrollPosition + 15;

            scrollPosition = Math.ceil(scrollPosition);

            if (scrollPosition < scrollLimit) {
              ngScrollElement[0].scrollTop = scrollPosition;
            }

          }

          if (scrollElementTop > dragElementTop) {

            var scrollPosition = scrollElementTop - dragElementTop;

            if (ngScrollElement[0].scrollTop) {

              scrollPosition = ngScrollElement[0].scrollTop - scrollPosition;

              ngScrollElement[0].scrollTop = scrollPosition;

            }

          }

        }

        var moveX = _cx - element[0].getBoundingClientRect().left;
        var moveY = _cy - element[0].getBoundingClientRect().top;

        moveX += element[0].offsetLeft;
        moveY += element[0].offsetTop;

        moveX -= mRegisterX;
        moveY -= mRegisterY;

        moveElement(moveX, moveY);

        var windowTop = easyDraggableUtils.scrollTop();
        var windowLeft = easyDraggableUtils.scrollLeft();

        _mx -= windowLeft;
        _my -= windowTop;

        $rootScope.$broadcast('draggable:move', {
          x: _mx,
          y: _my,
          tx: _tx,
          ty: _ty,
          element: element,
          dragElement: dragElement,
          data: _data
        });

      };

      var onDragComplete = function(evt, dragElement) {

        if (!onDragSuccessCallback)
          return;

        scope.$apply(function() {
          onDragSuccessCallback(scope, {
            $data: _data,
            $event: evt
          });
        });

        if (clone == 'true') {
          dragElement.remove();
        }
        dragElement.removeClass('iap-drag-animation easy-dragging');

      };

      var onDragInComplete = function(evt, dragElement) {
        dragElement.addClass('iap-drag-animation');
        dragElement.css({
          'left': initialX + 'px',
          'top': initialY + 'px',
          'width': initialWidth,
          'position': '',
          'z-index': ''
        });

        if (clone == 'true') {
          dragElement.remove();
        }

        dragElement.removeClass('iap-drag-animation easy-dragging');

      };

      var onRelease = function(evt) {

        if (!_dragEnabled)
          return;

        evt.preventDefault();

        //Class added to remove highlighting when start dragging
        element.removeClass('easy-drag-started');

        $rootScope.$broadcast('draggable:end', {
          x: _mx,
          y: _my,
          tx: _tx,
          ty: _ty,
          element: element,
          dragElement: dragElement,
          data: _data,
          successCallback: onDragComplete,
          failCallback: onDragInComplete
        });



        ngDocument.off(_moveEvents, onMove);
        ngDocument.off(_releaseEvents, onRelease);
        evt.stopPropagation();
        if (onDragStopCallback) {
          var data = {
            name: 'stopped',
            dragEl: element.attr('id')
          };
          scope.$apply(function() {
            onDragStopCallback(scope, {
              data: data
            });
          });
        }
      };

      var resetElement = function() {

        dragElement.removeClass('easy-dragging');

        if (clone == 'true') {
          dragElement.remove();

        } else {

          dragElement.css({
            'position': '',
            'z-index': ''
          });
        }

      };

      var moveElement = function(x, y) {

        dragElement.addClass('easy-dragging');

        dragElement.css({
          'left': x + 'px',
          'top': y + 'px',
          'position': 'absolute',
          'z-index': 99999,
          'width': '100%'
        });
      };

      initialize();
    }
  };
}]);

angular.module("easyDraggable").directive('easyDroppable', ['$parse', '$timeout', 'easyDraggableUtils', function($parse, $timeout, easyDraggableUtils) {
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      scope.value = attrs.easyDroppable;

      var onDropAction = (typeof attrs.onDropAction !== 'undefined') ? attrs.onDropAction : 'touch';

      var _dropEnabled = false;

      var onDropSuccess = $parse(attrs.onDropSuccess) || null; // || function(){};

      var id = element.attr("id");
      if (!id) {
        id = easyDraggableUtils.newUuid();
        element.attr("id", id);
      }

      element.addClass('easy-droppable');

      var initialize = function() {
        toggleListeners(true);
      };

      var toggleListeners = function(enable) {
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

      var onDestroy = function(enable) {
        toggleListeners(false);
      };

      var onEnableChange = function(newVal, oldVal) {
        _dropEnabled = (newVal);
        if (typeof _dropEnabled === 'string') {
          _dropEnabled = ((_dropEnabled == 'true') ? true : false);
        }
      };

      var onDragStart = function(evt, dragObj) {
        if (!_dropEnabled || (element.attr('easy-droppable') === 'false'))
          return;
        isTouching(dragObj);
      };

      var onDragMove = function(evt, dragObj) {
        if (!_dropEnabled || (element.attr('easy-droppable') === 'false'))
          return;
        isTouching(dragObj);
      };

      var onDragEnd = function(evt, dragObj) {
        if (!_dropEnabled || (element.attr('easy-droppable') === 'false'))
          return;

        var isHitting = isTouching(dragObj);

        if (isHitting) {

          // call the ngDraggable element callback
          if (dragObj.successCallback) {
            dragObj.successCallback(evt, dragObj.dragElement);
          }

          var data = {
            name: 'success',
            dropEl: element.attr('id'),
            dragEl: dragObj.element.attr('id'),
            dragElement: dragObj.dragElement,
            dropElement: element
          };

          scope.$apply(function(scope) {
            onDropSuccess(scope, {
              data: data
            });
          });


        } else {
          if (dragObj.failCallback) {
            dragObj.failCallback(evt, dragObj.dragElement);
          }
        }

        updateDragStyles(false, dragObj.element);
      };

      var isTouching = function(dragObj) {
        var touching = hitTest(dragObj);
        updateDragStyles(touching, dragObj.element);
        return touching;
      };

      //Updates classes in the DOM
      var updateDragStyles = function(touching, dragElement) {
        if (touching) {
          element.addClass('easy-drag-enter');
          dragElement.addClass('easy-drag-over');
        } else {
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

        switch (onDropAction) {

          //When the dragged element exactly fits to the droppable element
          case 'fit':
            isHitted = (dpL <= drL && drR <= dpR && dpT <= drT && drB <= dpB);
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
              (drT >= dpT && drT <= dpB) || // Top edge touching
              (drB >= dpT && drB <= dpB) || // Bottom edge touching
              (drT < dpT && drB > dpB) // Surrounded vertically
            ) && (
              (drL >= dpL && drL <= dpR) || // Left edge touching
              (drR >= dpL && drR <= dpR) || // Right edge touching
              (drL < dpL && drR > dpR) // Surrounded horizontally
            );

            break;

          default:
            isHitted = false;

        }

        return isHitted;
      };

      initialize();
    }
  };
}]);
