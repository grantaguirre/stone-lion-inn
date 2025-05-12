// /src/_includes/breadcrumbs.js

(function (document) {
  `use strict`;

  const home    = document.getElementById(`breadcrumb-home`);
  const path    = document.location.pathname;
  const rooms   = path.startsWith(`/rooms/`);
  const cottage  = path.startsWith(`/cottage/`);
  const legal   = path.startsWith(`/legal/`);

  let pathArray = path.split('/');
  let child  = pathArray[2];

  if (path === `/`) {
    return;
  } else if (rooms) {
    if (child) {
      home.insertAdjacentHTML(`afterend`, `<span class="breadcrumbs-separator" aria-hidden="true"> ✿ </span>`);
    };
    home.insertAdjacentHTML(`afterend`, `<span class="breadcrumbs-separator" aria-hidden="true"> ✿ </span><span role="listitem">rooms</span>`);
  } else if (cottage) {
    if (child) {
      home.insertAdjacentHTML(`afterend`, `<span class="breadcrumbs-separator" aria-hidden="true"> ✿ </span>`);
    };
    home.insertAdjacentHTML(`afterend`, `<span class="breadcrumbs-separator" aria-hidden="true"> ✿ </span><span role="listitem">the cottage</span>`);
  } else if (legal) {
    if (child) {
      home.insertAdjacentHTML(`afterend`, `<span class="breadcrumbs-separator" aria-hidden="true"> ✿ </span>`);
    };
    home.insertAdjacentHTML(`afterend`, `<span class="breadcrumbs-separator" aria-hidden="true"> ✿ </span><span role="listitem">legal</span>`);
  } else {
    home.insertAdjacentHTML(`afterend`, `<span class="breadcrumbs-separator" aria-hidden="true"> ✿ </span>`);
  };

})(document);
