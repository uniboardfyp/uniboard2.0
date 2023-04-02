async function registerCourse(sectionCode) {
  console.log(sectionCode);
}
const urlParams = new URLSearchParams(window.location.search);
const myParam = urlParams.get('e');
if (myParam == 'Course_Already_Registered') {
  alert('The Course Is Already Registered!');
  window.location.href = 'http://localhost:3000/studentportal/courseregister';
} else if (myParam == 'Time_Clash') {
  alert('There is a Clash in Timing!');
  window.location.href = 'http://localhost:3000/studentportal/courseregister';
} else if (myParam == 'Course_Seat_Full') {
  alert('Seats Full!');
  window.location.href = 'http://localhost:3000/studentportal/courseregister';
} else if (myParam == 'Courses_Limit_Reached') {
  alert('Maximum Course Limit Reached');
  window.location.href = 'http://localhost:3000/studentportal/courseregister';
}
// $('.btn').click(function () {
//   var $item = $(this)
//     .closest('tr') // Finds the closest row <tr>
//     .find('.nr') // Gets a descendent with class="nr"
//     .text(); // Retrieves the text within <td>

//   $('#resultas').append($item); // Outputs the answer
// });
