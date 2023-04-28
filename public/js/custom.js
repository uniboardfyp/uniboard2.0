$(document).ready(function () {
  $('#tableSearch').on('keyup', function () {
    var value = $(this).val().toLowerCase();
    $('#myTable tr').filter(function () {
      $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
    });
  });
});
$(document).ready(function () {
  $('#myInput').on('keyup', function () {
    var value = $(this).val().toLowerCase();
    $('.dropdown-menu #myInput ~ li').filter(function () {
      $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
    });
  });
});
$(document).ready(function () {
  $('#myInput2').on('keyup', function () {
    var value = $(this).val().toLowerCase();
    $('.dropdown-menu #myInput2 ~ li').filter(function () {
      $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
    });
  });
});
$(document).ready(function () {
  $('#myInput3').on('keyup', function () {
    var value = $(this).val().toLowerCase();
    $('.dropdown-menu #myInput3 ~ li').filter(function () {
      $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
    });
  });
});
